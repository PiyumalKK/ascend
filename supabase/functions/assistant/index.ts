// ASCEND assistant: turns plain-language requests into validated content edits.
//
// POST { message: string, history?: {role:'user'|'assistant', content:string}[] }
// Auth: the caller's Supabase JWT; only the owner email may use it.
// Returns { reply, changes: [{ section, label, before, after }], provider, model }.
// Nothing is saved here: the client previews the changes and saves on "Apply".
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY, GROQ_API_KEY      at least one is required
//   AI_PRIMARY=gemini|groq            default gemini (the other is the fallback)
//   GEMINI_MODEL, GROQ_MODEL          optional model overrides
//   OWNER_EMAIL                       default piyumalm912@gmail.com

import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { SECTIONS as SECTION_DEFS, SECTION_IDS, getAt, setAt, validateSection, fillDefaults } from '../_shared/content-schema.js'
import DEFAULT_CONTENT from '../_shared/default-content.js'

const SECTIONS = SECTION_DEFS as Record<string, { label: string }>

const OWNER_EMAIL = (Deno.env.get('OWNER_EMAIL') ?? 'piyumalm912@gmail.com').toLowerCase()
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const PRIMARY = (Deno.env.get('AI_PRIMARY') ?? 'gemini').toLowerCase()

// Candidate models in preference order. A configured model goes first; names that a provider
// has retired are skipped automatically using its live model list.
const GEMINI_CANDIDATES = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest']
  .filter(Boolean) as string[]
const GROQ_CANDIDATES = [Deno.env.get('GROQ_MODEL'), 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'moonshotai/kimi-k2-instruct-0905', 'qwen/qwen3-32b', 'openai/gpt-oss-20b']
  .filter(Boolean) as string[]
const CALL_TIMEOUT_MS = 45_000
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ---------------------------------------------------------------- LLM providers
type Msg = { role: 'user' | 'assistant'; content: string }

type Effort = 'low' | 'medium'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const RETRYABLE = new Set([429, 500, 502, 503, 504])

async function callGemini(model: string, system: string, messages: Msg[], maxTokens = 8192): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: maxTokens },
    }),
  })
  if (!res.ok) throw new HttpError(res.status, `${res.status} ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  if (!text) throw new HttpError(502, `no text (${data?.candidates?.[0]?.finishReason ?? 'unknown'})`)
  return text
}

async function callGroq(model: string, system: string, messages: Msg[], jsonMode = true, effort: Effort = 'low', maxTokens = 4096): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      // Groq's free tier counts this cap against its per-request token limit, so keep it tight.
      max_completion_tokens: maxTokens,
      ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: effort } : {}),
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    // Some models reject JSON mode; retry the same model without it.
    if (res.status === 400 && jsonMode && /response_format|json/i.test(text)) return callGroq(model, system, messages, false, effort, maxTokens)
    throw new HttpError(res.status, `${res.status} ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

// Live model lists, cached per function instance.
const modelCache: Record<string, Promise<Set<string> | null>> = {}
function availableModels(provider: 'gemini' | 'groq'): Promise<Set<string> | null> {
  modelCache[provider] ??= (async () => {
    try {
      if (provider === 'groq') {
        const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${GROQ_KEY}` }, signal: AbortSignal.timeout(8000) })
        if (!r.ok) return null
        return new Set(((await r.json()).data ?? []).map((m: { id: string }) => m.id))
      }
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': GEMINI_KEY }, signal: AbortSignal.timeout(8000) })
      if (!r.ok) return null
      return new Set(((await r.json()).models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, '')))
    } catch {
      return null
    }
  })()
  return modelCache[provider]
}

type Attempt = { provider: 'gemini' | 'groq'; model: string }

// Circuit breaker: models that are out of quota, retired or hanging are skipped for a while.
const deadUntil = new Map<string, number>()
const isDead = (a: Attempt) => (deadUntil.get(`${a.provider}/${a.model}`) ?? 0) > Date.now()
function markFailure(a: Attempt, status: number, message: string) {
  const key = `${a.provider}/${a.model}`
  if (status === 404) deadUntil.set(key, Date.now() + 6 * 60 * 60_000)
  else if (status === 429) {
    // Daily quota or a model with no free quota: rest it for a while. Per-minute limits: about a minute.
    const daily = /per ?day|PerDay|limit: 0\b|free_tier_requests.*limit: 0/i.test(message)
    deadUntil.set(key, Date.now() + (daily ? 60 * 60_000 : 65_000))
  } else if (/timed out|timeout|abort/i.test(message)) deadUntil.set(key, Date.now() + 15 * 60_000)
}

let DIAG_ALL = false
async function attemptPlan(): Promise<Attempt[]> {
  const order: ('gemini' | 'groq')[] = PRIMARY === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq']
  const plan: Attempt[] = []
  for (const provider of order) {
    if (provider === 'gemini' && !GEMINI_KEY) continue
    if (provider === 'groq' && !GROQ_KEY) continue
    const candidates = provider === 'gemini' ? GEMINI_CANDIDATES : GROQ_CANDIDATES
    const live = await availableModels(provider)
    let usable = live ? candidates.filter((m) => live.has(m)) : candidates
    if (provider === 'gemini' && live) {
      // Prefer the newest stable Flash models Google currently offers (names change often).
      const pinned = Deno.env.get('GEMINI_MODEL')
      const ver = (m: string) => parseFloat(m.split('-')[1]) || 0
      const pinnedVer = pinned ? ver(pinned) : Infinity
      const flash = [...live].filter((m) => /^gemini-\d+(\.\d+)?-flash(-lite)?$/.test(m) && ver(m) <= pinnedVer)
      const lite = flash.filter((m) => m.endsWith('-lite')).sort((a, b) => ver(b) - ver(a))
      const full = flash.filter((m) => !m.endsWith('-lite')).sort((a, b) => ver(b) - ver(a))
      usable = [...new Set([...(pinned && live.has(pinned) ? [pinned] : []), ...lite, ...full, ...usable])]
    }
    // Keep at most two models per provider so a bad day cannot take minutes.
    const healthy = [...new Set(usable.length ? usable : candidates)].filter((model) => DIAG_ALL || !isDead({ provider, model }))
    for (const model of healthy.slice(0, 2)) plan.push({ provider, model })
    if (DIAG_ALL) for (const model of usable.slice(2, 6)) plan.push({ provider, model })
  }
  return plan
}

/** Ask the models in order, retrying busy ones once; fall back on errors or unparseable output. */
async function askJSON(system: string, messages: Msg[], used: { provider?: string; model?: string }, effort: Effort = 'low', maxTokens = 4096) {
  const plan = await attemptPlan()
  if (!plan.length) throw new HttpError(500, 'No AI key configured. Add GEMINI_API_KEY or GROQ_API_KEY in Supabase secrets.')
  const errors: string[] = []
  for (const { provider, model } of plan) {
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      try {
        const raw = provider === 'gemini' ? await callGemini(model, system, messages, Math.max(maxTokens, 8192)) : await callGroq(model, system, messages, true, effort, maxTokens)
        const parsed = parseJSON(raw)
        used.provider = provider
        used.model = model
        return parsed
      } catch (e) {
        const status = e instanceof HttpError ? e.status : 0
        errors.push(`${provider}/${model}: ${(e as Error).message}`)
        markFailure({ provider, model }, status, (e as Error).message)
        if (status === 429) break // another model is faster than waiting out a rate limit
        if (tryNo === 0 && RETRYABLE.has(status)) {
          await sleep(1500)
          continue
        }
        break
      }
    }
  }
  console.error('AI providers failed', errors)
  const detail = errors.map((e) => `• ${e.slice(0, 180)}`).join('\n')
  throw new HttpError(502, `The AI services are busy right now. Please try again in a minute.\n${detail}`)
}

function parseJSON(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('Model did not return valid JSON')
  }
}

// ---------------------------------------------------------------- prompts
function nowInColombo() {
  return new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const SECTION_CATALOG = [
  ...SECTION_IDS.map((id) => `- ${id}: ${SECTIONS[id].label}`),
  '- money: Expense and income records. Pick this to LOG spending or earnings ("spent 1200 on lunch") or to answer questions about money',
].join('\n')

function routerPrompt(plan: string) {
  return `You are the planner for ASCEND, a personal timetable and life-plan website owned by Piyumal, a DevOps engineer in Sri Lanka.
The site content is a JSON document split into these sections:
${SECTION_CATALOG}

Given the conversation, decide which sections are needed to answer or to make the requested change.
Pick the smallest set that is enough. Timetable requests usually need one or more "schedule.*" sections.
"Weekdays" means Monday-Friday (the "weekday" section). Plan A = no bike (current), Plan B = with bike and gym.
The user is currently viewing Plan ${plan}. If they do not name a plan, include the matching sections of BOTH plans
(the block usually exists in both); do not ask which plan.
Ask a short clarifying question only if the request is genuinely impossible to interpret.

Reply with JSON only: {"sections": ["id", ...], "clarify": "question or empty string"}`
}

function editorPrompt(pillars: Record<string, { label: string }>, plan: string) {
  const pillarList = Object.entries(pillars).map(([k, v]) => `${k} (${v.label})`).join(', ')
  return `You are the editor for ASCEND, Piyumal's personal timetable and life-plan website. Today is ${nowInColombo()} (Sri Lanka time).
You receive some sections of the site content as JSON plus the user's request. Either answer a question about them, or edit them.

Rules for edits:
- If the user does not name a plan, apply the change to every provided plan section where it fits (they are viewing Plan ${plan}).
- Change only what the user asked. Keep every other item, word and field exactly as it is.
- For each section you change, return its COMPLETE new value (the whole list or object), not a fragment.
- Times are 24h "HH:MM". Blocks in one day must not overlap; only the final sleep block may cross midnight.
  When you move or resize a block, shift or shorten neighbouring FLEXIBLE blocks so the day stays continuous and sensible.
- FIXED commitments never move unless the user explicitly asks to change them: office, commute/ride, prayer, wake-up and sleep.
  Make room by shortening or moving flexible blocks (deep work, study, English, research, content, meals, family time) instead.
- "pillar" must be one of: ${pillarList}. Add a new category only by also returning the "pillars" section.
- Weekday rotations: a block's optional "byDay" maps "1"-"5" (Mon-Fri) to overrides of title/pillar/detail.
- A change for one specific date or a single day only belongs in "schedule.overrides" with key "A-<weekday>" or "B-<weekday>" (0=Sunday ... 6=Saturday) holding that full day.
- Keep the writing style: short, direct, practical. Do not invent facts about real people.
- If the request cannot be done with these sections, say so in "reply" and return no changes.

Money (only when "money" data is provided):
- To log spending or earnings, return them in "transactions": [{"kind":"expense"|"income","amount":number,"currency":"LKR","category":"<key>","note":"short note","date":"YYYY-MM-DD"}].
- Use the category keys from "finance.categories" (expenses) or "finance.incomeCategories" (income); pick the closest, else "other" / "other_income".
- Default currency is finance.currency; dates default to today ("money.today"). "Yesterday" etc. are relative to that date.
- Rs, rupees and LKR mean LKR; $ and dollars mean USD. Never invent amounts; ask if one is missing.
- To answer money questions, calculate from "money.transactions" and "money.totals". Be precise and show the numbers.
- Logging money never needs "changes"; editing categories or budgets goes in the "finance" section.

Reply with JSON only:
{"reply": "1-3 sentences for the user: what you changed and why, or the answer", "summary": "short commit-style summary of the change, or empty", "changes": [{"section": "<section id>", "value": <complete new value>}], "transactions": []}`
}

// ---------------------------------------------------------------- voice transcription
const WHISPER_PROMPT = 'ASCEND timetable. Plan A, Plan B, Deep Work, Fiverr, AWS, Terraform, LKR, rupees, Sri Lanka.'

async function transcribe(base64: string, mime: string): Promise<{ text: string; via: string }> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  if (bytes.length > 8_000_000) throw new HttpError(413, 'Recording is too long. Keep it under a minute.')
  const errors: string[] = []
  if (GROQ_KEY) {
    try {
      const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
      const form = new FormData()
      form.append('file', new Blob([bytes], { type: mime }), `voice.${ext}`)
      form.append('model', Deno.env.get('WHISPER_MODEL') ?? 'whisper-large-v3-turbo')
      form.append('response_format', 'json')
      form.append('temperature', '0')
      form.append('prompt', WHISPER_PROMPT)
      const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: form, signal: AbortSignal.timeout(45_000),
      })
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
      return { text: String((await r.json()).text ?? '').trim(), via: 'groq-whisper' }
    } catch (e) {
      errors.push(`groq: ${(e as Error).message}`)
    }
  }
  if (GEMINI_KEY) {
    for (const a of (await attemptPlan()).filter((x) => x.provider === 'gemini')) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${a.model}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(45_000),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [
              { inline_data: { mime_type: mime.split(';')[0], data: base64 } },
              { text: `Transcribe this voice note exactly, in the language spoken. Return only the transcript. Context: ${WHISPER_PROMPT}` },
            ] }],
            generationConfig: { temperature: 0, maxOutputTokens: 1024 },
          }),
        })
        if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
        const d = await r.json()
        const text = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim()
        if (text) return { text, via: `gemini/${a.model}` }
      } catch (e) {
        errors.push(`gemini/${a.model}: ${(e as Error).message}`)
      }
    }
  }
  throw new HttpError(502, `Could not transcribe the recording. ${errors.join(' | ').slice(0, 300)}`)
}

// ---------------------------------------------------------------- money
function colomboToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

// deno-lint-ignore no-explicit-any
async function loadMoney(supabase: any) {
  const since = new Date(Date.now() - 92 * 86400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('transactions').select('kind, amount, currency, category, note, occurred_on')
    .gte('occurred_on', since).order('occurred_on', { ascending: false }).limit(400)
  if (error) return { error: error.message }
  // totals["2026-10 expense LKR"] = { food: 4200, transport: 900, ... }
  const totals: Record<string, Record<string, number>> = {}
  for (const t of data) {
    const key = `${t.occurred_on.slice(0, 7)} ${t.kind} ${t.currency}`
    totals[key] ??= {}
    totals[key][t.category] = Math.round(((totals[key][t.category] ?? 0) + Number(t.amount)) * 100) / 100
  }
  return { today: colomboToday(), totals, transactions: data.slice(0, 120) }
}

type Tx = { kind: string; amount: number; currency: string; category: string; note?: string; date?: string }

// deno-lint-ignore no-explicit-any
function validateTransactions(list: unknown, finance: any): { txs: Tx[]; errors: string[] } {
  const errors: string[] = []
  const txs: Tx[] = []
  if (list == null) return { txs, errors }
  if (!Array.isArray(list)) return { txs, errors: ['"transactions" must be a list'] }
  const exp = new Set((finance?.categories ?? []).map((c: { key: string }) => c.key))
  const inc = new Set((finance?.incomeCategories ?? []).map((c: { key: string }) => c.key))
  const today = colomboToday()
  const oldest = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10)
  list.slice(0, 20).forEach((t: Tx, i: number) => {
    const p = `transactions[${i}]`
    if (t?.kind !== 'expense' && t?.kind !== 'income') {
      errors.push(`${p}.kind must be expense or income`)
      return
    }
    const amount = Number(t.amount)
    if (!(amount > 0 && amount < 1e9)) errors.push(`${p}.amount must be a positive number`)
    const currency = String(t.currency || finance?.currency || 'LKR').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) errors.push(`${p}.currency must be a 3-letter code`)
    const cats = t.kind === 'expense' ? exp : inc
    if (!cats.has(t.category)) errors.push(`${p}.category "${t.category}" is not one of: ${[...cats].join(', ')}`)
    const date = t.date || today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || date < oldest) errors.push(`${p}.date must be YYYY-MM-DD and not in the future`)
    txs.push({ kind: t.kind, amount: Math.round(amount * 100) / 100, currency, category: t.category, note: String(t.note ?? '').slice(0, 300), date })
  })
  return { txs, errors }
}

// ---------------------------------------------------------------- quick router
const DAYS = /\b(mon|tues?|wed(nes)?|thu(rs)?|fri|weekdays?)(day)?s?\b/i
function quickRoute(message: string): string[] | null {
  const m = message.toLowerCase()
  const plans = /plan\s*b|bike|gym/.test(m) && !/plan\s*a/.test(m) ? ['B'] : /plan\s*a/.test(m) && !/plan\s*b/.test(m) ? ['A'] : ['A', 'B']
  if (/\b(spent|spend|paid|pay|bought|buy|expense|income|earned|salary|budget|rs\.?|rupees?|lkr|usd|\$\s?\d)/.test(m)) return ['money']
  if (/\b(channel|chanel)s?\b/.test(m)) return ['channels']
  if (/\broad ?map\b|milestone/.test(m)) return ['roadmap']
  if (/\bscorecard\b/.test(m)) return ['scorecard', 'scorecardWin']
  if (/\b(legend|successful (men|people))\b/.test(m)) return ['legends']
  if (/\bcert(ification)?s?\b|\bexam\b/.test(m) && !/\b(\d{1,2}[:.]\d{2}|am|pm)\b/.test(m)) return ['certs']
  if (/\bgigs?\b/.test(m)) return ['gigs']
  const times = /\b(\d{1,2}([:.]\d{2})?\s?(am|pm)?|minutes?|mins?|hours?|earlier|later|morning|evening|block)\b/.test(m)
  if (/\bsundays?\b/.test(m) && times) return plans.map((p) => `schedule.${p}.sunday`)
  if (/\bsaturdays?\b/.test(m) && times) return plans.map((p) => `schedule.${p}.saturday`)
  if (DAYS.test(m) && times) return plans.map((p) => `schedule.${p}.weekday`)
  return null
}

// ---------------------------------------------------------------- fixed-commitment guard
const FIXED_PILLARS = new Set(['office', 'commute', 'sleep'])
const FIXED_TITLE = /prayer|wake/i
const FIXED_WORDS = /office|work hours|commute|ride|bike|travel|prayer|pray|wake|alarm|sleep|bed|lights out/i

type Block = { start: string; end: string; title: string; pillar: string }
const isFixed = (b: Block) => FIXED_PILLARS.has(b.pillar) || FIXED_TITLE.test(b.title)
const sig = (b: Block) => `${b.title}@${b.start}-${b.end}`

/** Errors for fixed blocks that changed although the user's message never mentioned them. */
function fixedBlockErrors(section: string, before: unknown, after: unknown, message: string): string[] {
  if (!section.startsWith('schedule.') || FIXED_WORDS.test(message)) return []
  if (!Array.isArray(before) || !Array.isArray(after)) return []
  const afterSigs = new Set((after as Block[]).filter(isFixed).map(sig))
  return (before as Block[]).filter(isFixed).filter((b) => !afterSigs.has(sig(b)))
    .map((b) => `${section}: fixed block "${b.title}" (${b.start}-${b.end}) must stay exactly as it is; adjust flexible blocks instead`)
}

// ---------------------------------------------------------------- handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: auth } = await supabase.auth.getUser()
    const email = auth?.user?.email?.toLowerCase()
    if (!email) throw new HttpError(401, 'Your session has expired. Please sign in again.')
    if (email !== OWNER_EMAIL) throw new HttpError(403, 'Only the owner can use the assistant.')

    const body = await req.json().catch(() => ({}))
    const plan = body.plan === 'B' ? 'B' : 'A'
    if (body.action === 'transcribe') {
      const audio = String(body.audio ?? '')
      if (!audio) throw new HttpError(400, 'No audio received.')
      return json(await transcribe(audio, String(body.mime ?? 'audio/webm')))
    }
    if (body.action === 'models') {
      // Diagnostics: ping every model in the plan with a tiny JSON request.
      DIAG_ALL = true
      const plan = await attemptPlan()
      DIAG_ALL = false
      const results = []
      for (const a of plan) {
        const t = Date.now()
        try {
          const sys = 'Reply with JSON only: {"ok": true}'
          const raw = a.provider === 'gemini' ? await callGemini(a.model, sys, [{ role: 'user', content: 'ping' }], 64) : await callGroq(a.model, sys, [{ role: 'user', content: 'ping' }], true, 'low', 64)
          results.push({ ...a, ok: true, ms: Date.now() - t, sample: raw.slice(0, 60) })
        } catch (e) {
          results.push({ ...a, ok: false, ms: Date.now() - t, error: (e as Error).message.slice(0, 900) })
        }
      }
      return json({ primary: PRIMARY, results })
    }
    const message = String(body.message ?? '').trim().slice(0, 4000)
    if (!message) throw new HttpError(400, 'Empty message.')
    const history: Msg[] = (Array.isArray(body.history) ? body.history : [])
      .slice(-8)
      .filter((m: Msg) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 2000) }))

    // Current content: the newest version (fall back to an empty doc; the client always seeds first).
    const { data: row, error: rowErr } = await supabase
      .from('content_versions').select('id, content').order('id', { ascending: false }).limit(1).maybeSingle()
    if (rowErr) throw new HttpError(500, `Could not read content: ${rowErr.message}`)
    if (!row) throw new HttpError(409, 'No content saved yet. Open the website signed in once, then try again.')
    // Older saved documents may lack sections added later; fill them from the defaults.
    const content = fillDefaults(row.content, DEFAULT_CONTENT)

    const used: { provider?: string; model?: string } = {}
    const convo: Msg[] = [...history, { role: 'user', content: message }]

    // 1) Route: which sections matter? Obvious requests skip the extra model call.
    const quick = quickRoute(message)
    const route = quick ? { sections: quick } : await askJSON(routerPrompt(plan), convo, used, 'low', 600)
    if (route?.clarify) {
      return json({ reply: String(route.clarify), changes: [], provider: used.provider, model: used.model, baseVersion: row.id })
    }
    const sections: string[] = (Array.isArray(route?.sections) ? route.sections : [])
      .filter((s: string) => SECTION_IDS.includes(s) || s === 'money').slice(0, 8)
    if (!sections.length) sections.push('site')
    const wantsMoney = sections.includes('money')
    const contentSections = sections.filter((s) => s !== 'money')
    if (wantsMoney && !contentSections.includes('finance')) contentSections.push('finance')

    // 2) Edit with validation and up to two repair rounds.
    const payload: Record<string, unknown> = Object.fromEntries(contentSections.map((s) => [s, getAt(content, s)]))
    if (wantsMoney) payload.money = await loadMoney(supabase)
    const editMsgs: Msg[] = [
      ...history,
      { role: 'user', content: `Current sections:\n${JSON.stringify(payload)}\n\nRequest: ${message}` },
    ]
    let result: { reply?: string; summary?: string; changes?: { section: string; value: unknown }[]; transactions?: unknown } = {}
    let txs: Tx[] = []
    let errors: string[] = []
    const started = Date.now()
    for (let attempt = 0; attempt < 3; attempt++) {
      result = await askJSON(editorPrompt(content.pillars, plan), editMsgs, used, 'medium', 4096)
      const changes = Array.isArray(result?.changes) ? result.changes : []
      errors = []
      let next = content
      for (const c of changes) {
        if (!SECTION_IDS.includes(c.section)) {
          errors.push(`"${c.section}" is not an editable section`)
          continue
        }
        next = setAt(next, c.section, c.value)
      }
      const touched = new Set(changes.map((c) => c.section))
      // Changing categories can invalidate any section that references them.
      const toCheck = touched.has('pillars') ? SECTION_IDS : [...touched]
      for (const s of toCheck) errors.push(...validateSection(s, getAt(next, s), next))
      for (const c of changes) errors.push(...fixedBlockErrors(c.section, getAt(content, c.section), c.value, message))
      const financeAfter = changes.find((c) => c.section === 'finance')?.value ?? content.finance
      const tx = validateTransactions(result?.transactions, financeAfter)
      txs = tx.txs
      errors.push(...tx.errors)
      if (!errors.length) break
      if (Date.now() - started > 75_000) break // stay well inside the function's time limit
      editMsgs.push({ role: 'assistant', content: JSON.stringify(result) })
      editMsgs.push({ role: 'user', content: `Your edit failed validation. Fix these problems and return the full corrected JSON:\n- ${errors.slice(0, 15).join('\n- ')}` })
    }
    if (errors.length) {
      return json({
        reply: `I couldn't make a valid version of that change (${errors.slice(0, 3).join('; ')}). Try rephrasing or splitting it into smaller steps.`,
        changes: [], provider: used.provider, model: used.model, baseVersion: row.id,
      })
    }

    const changes = (result.changes ?? [])
      .filter((c) => JSON.stringify(getAt(content, c.section)) !== JSON.stringify(c.value))
      .map((c) => ({ section: c.section, label: SECTIONS[c.section].label, before: getAt(content, c.section), after: c.value }))

    // Best-effort chat log for later analysis.
    await supabase.from('ai_messages').insert([
      { user_id: auth.user!.id, role: 'user', content: message },
      { user_id: auth.user!.id, role: 'assistant', content: String(result.reply ?? ''), meta: { sections: changes.map((c) => c.section), provider: used.provider } },
    ])

    return json({
      transactions: txs,
      reply: String(result.reply ?? (changes.length ? 'Here is the change.' : 'Done.')),
      summary: String(result.summary ?? '').slice(0, 300),
      changes,
      provider: used.provider,
      model: used.model,
      baseVersion: row.id,
    })
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    console.error(e)
    return json({ error: (e as Error).message }, status)
  }
})

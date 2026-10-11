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
import { SECTIONS as SECTION_DEFS, SECTION_IDS, getAt, setAt, validateSection } from '../_shared/content-schema.js'

const SECTIONS = SECTION_DEFS as Record<string, { label: string }>

const OWNER_EMAIL = (Deno.env.get('OWNER_EMAIL') ?? 'piyumalm912@gmail.com').toLowerCase()
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest'
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile'
const PRIMARY = (Deno.env.get('AI_PRIMARY') ?? 'gemini').toLowerCase()

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

async function callGemini(system: string, messages: Msg[]): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 16384 },
    }),
  })
  if (!res.ok) throw new HttpError(res.status, `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  if (!text) throw new HttpError(502, `Gemini returned no text (${data?.candidates?.[0]?.finishReason ?? 'unknown'})`)
  return text
}

async function callGroq(system: string, messages: Msg[]): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) throw new HttpError(res.status, `Groq ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

const PROVIDERS = {
  gemini: { key: () => GEMINI_KEY, call: callGemini, model: () => GEMINI_MODEL },
  groq: { key: () => GROQ_KEY, call: callGroq, model: () => GROQ_MODEL },
} as const
type ProviderName = keyof typeof PROVIDERS

function providerOrder(): ProviderName[] {
  const first: ProviderName = PRIMARY === 'groq' ? 'groq' : 'gemini'
  const second: ProviderName = first === 'gemini' ? 'groq' : 'gemini'
  return [first, second].filter((p) => PROVIDERS[p].key())
}

/** Ask the models in order; fall back on errors or unparseable output. */
async function askJSON(system: string, messages: Msg[], used: { provider?: string; model?: string }) {
  const errors: string[] = []
  for (const name of providerOrder()) {
    const p = PROVIDERS[name]
    try {
      const raw = await p.call(system, messages)
      const parsed = parseJSON(raw)
      used.provider = name
      used.model = p.model()
      return parsed
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`)
    }
  }
  if (!providerOrder().length) throw new HttpError(500, 'No AI key configured. Add GEMINI_API_KEY or GROQ_API_KEY in Supabase secrets.')
  throw new HttpError(502, `All AI providers failed. ${errors.join(' | ')}`)
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

const SECTION_CATALOG = SECTION_IDS.map((id) => `- ${id}: ${SECTIONS[id].label}`).join('\n')

function routerPrompt() {
  return `You are the planner for ASCEND, a personal timetable and life-plan website owned by Piyumal, a DevOps engineer in Sri Lanka.
The site content is a JSON document split into these sections:
${SECTION_CATALOG}

Given the conversation, decide which sections are needed to answer or to make the requested change.
Pick the smallest set that is enough. Timetable requests usually need one or more "schedule.*" sections.
"Weekdays" means Monday-Friday (the "weekday" section). Plan A = no bike (current), Plan B = with bike and gym.
If the request is unclear or impossible, ask a short clarifying question instead.

Reply with JSON only: {"sections": ["id", ...], "clarify": "question or empty string"}`
}

function editorPrompt(pillars: Record<string, { label: string }>) {
  const pillarList = Object.entries(pillars).map(([k, v]) => `${k} (${v.label})`).join(', ')
  return `You are the editor for ASCEND, Piyumal's personal timetable and life-plan website. Today is ${nowInColombo()} (Sri Lanka time).
You receive some sections of the site content as JSON plus the user's request. Either answer a question about them, or edit them.

Rules for edits:
- Change only what the user asked. Keep every other item, word and field exactly as it is.
- For each section you change, return its COMPLETE new value (the whole list or object), not a fragment.
- Times are 24h "HH:MM". Blocks in one day must not overlap; only the final sleep block may cross midnight.
  When you move or resize a block, shift or shorten neighbouring blocks so the day stays continuous and sensible.
- "pillar" must be one of: ${pillarList}. Add a new category only by also returning the "pillars" section.
- Weekday rotations: a block's optional "byDay" maps "1"-"5" (Mon-Fri) to overrides of title/pillar/detail.
- A change for one specific date or a single day only belongs in "schedule.overrides" with key "A-<weekday>" or "B-<weekday>" (0=Sunday ... 6=Saturday) holding that full day.
- Keep the writing style: short, direct, practical. Do not invent facts about real people.
- If the request cannot be done with these sections, say so in "reply" and return no changes.

Reply with JSON only:
{"reply": "1-3 sentences for the user: what you changed and why, or the answer", "summary": "short commit-style summary of the change, or empty", "changes": [{"section": "<section id>", "value": <complete new value>}]}`
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
    if (!email) throw new HttpError(401, 'Please sign in.')
    if (email !== OWNER_EMAIL) throw new HttpError(403, 'Only the owner can use the assistant.')

    const body = await req.json().catch(() => ({}))
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
    const content = row.content

    const used: { provider?: string; model?: string } = {}
    const convo: Msg[] = [...history, { role: 'user', content: message }]

    // 1) Route: which sections matter?
    const route = await askJSON(routerPrompt(), convo, used)
    if (route?.clarify) {
      return json({ reply: String(route.clarify), changes: [], provider: used.provider, model: used.model, baseVersion: row.id })
    }
    const sections: string[] = (Array.isArray(route?.sections) ? route.sections : [])
      .filter((s: string) => SECTION_IDS.includes(s)).slice(0, 8)
    if (!sections.length) sections.push('site')

    // 2) Edit with validation and up to two repair rounds.
    const payload = Object.fromEntries(sections.map((s) => [s, getAt(content, s)]))
    const editMsgs: Msg[] = [
      ...history,
      { role: 'user', content: `Current sections:\n${JSON.stringify(payload)}\n\nRequest: ${message}` },
    ]
    let result: { reply?: string; summary?: string; changes?: { section: string; value: unknown }[] } = {}
    let errors: string[] = []
    for (let attempt = 0; attempt < 3; attempt++) {
      result = await askJSON(editorPrompt(content.pillars), editMsgs, used)
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
      if (!errors.length) break
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

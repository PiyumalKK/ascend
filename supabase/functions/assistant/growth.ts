// Growth features for the assistant: a compact snapshot of everything on the site and in the
// owner's data, an analysis with actionable suggestions, and a live news digest.

// deno-lint-ignore-file no-explicit-any
type Msg = { role: 'user' | 'assistant'; content: string }
type AskJSON = (system: string, messages: Msg[], used: { provider?: string; model?: string }, effort?: 'low' | 'medium', maxTokens?: number) => Promise<any>

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function colomboNow() {
  const now = new Date()
  const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false })
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return { date, time, weekday, label: `${DAY[weekday]} ${date} ${time}` }
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const len = (b: any) => (toMin(b.end) - toMin(b.start) + 1440) % 1440 || 1440

function daySchedule(content: any, plan: string, day: number) {
  const s = content.schedule
  const raw = s.overrides?.[`${plan}-${day}`] || s[plan]?.[day === 6 ? 'saturday' : day === 0 ? 'sunday' : 'weekday'] || []
  return raw.map((b: any) => ({ ...b, ...(b.byDay?.[String(day)] || {}) })).sort((a: any, b: any) => toMin(a.start) - toMin(b.start))
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Everything the assistant should know, kept compact enough for free-tier models. */
export async function buildSnapshot(supabase: any, content: any, fallbackPlan: string) {
  const now = colomboNow()
  const [{ data: state }, { data: score }, { data: money }] = await Promise.all([
    supabase.from('app_state').select('key, value'),
    supabase.from('scorecard_days').select('day, items, score').gte('day', shiftDate(now.date, -28)).order('day'),
    supabase.from('transactions').select('kind, amount, currency, category, occurred_on').gte('occurred_on', `${shiftDate(now.date, -62).slice(0, 7)}-01`),
  ])
  const kv = Object.fromEntries((state ?? []).map((r: any) => [r.key, r.value]))
  const plan = kv.plan === 'B' ? 'B' : kv.plan === 'A' ? 'A' : fallbackPlan

  // Timetable: today in full, the week as hours per category.
  const today = daySchedule(content, plan, now.weekday)
  const current = today.find((b: any) => {
    const s = toMin(b.start), e = toMin(b.end), m = toMin(now.time)
    return e > s ? m >= s && m < e : m >= s || m < e
  })
  const weekHours: Record<string, number> = {}
  for (let d = 0; d < 7; d++) for (const b of daySchedule(content, plan, d)) weekHours[b.pillar] = Math.round(((weekHours[b.pillar] ?? 0) + len(b) / 60) * 10) / 10

  // Scorecard: completion rate per habit over 28 days, streak, last 7 days.
  const items = content.scorecard.map((s: any) => s.id)
  const byDay = Object.fromEntries((score ?? []).map((r: any) => [r.day, r.items || {}]))
  const firstDay = Object.keys(byDay).sort()[0] ?? null
  const trackedDays = firstDay ? Math.round((Date.parse(`${now.date}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) / 86400_000) + 1 : 0
  const rates: Record<string, string> = {}
  for (const s of content.scorecard) {
    const done = Object.values(byDay).filter((it: any) => it[s.id]).length
    rates[s.label] = trackedDays ? `${done}/${trackedDays} tracked days` : 'not tracked yet'
  }
  let streak = 0
  for (let i = 1; i <= 28; i++) {
    const it = byDay[shiftDate(now.date, -i)] || {}
    if (items.filter((k: string) => it[k]).length >= content.scorecardWin) streak++
    else break
  }
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDate(now.date, -6 + i)
    const it = byDay[d] || {}
    return `${d.slice(5)}:${items.filter((k: string) => it[k]).length}`
  })

  // Fiverr launch progress.
  const start = typeof kv.start === 'string' ? kv.start : '2026-10-12' // the site's default Day 1
  const dayN = start ? Math.round((Date.parse(`${now.date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400_000) + 1 : null
  const done = kv['fiverr.done'] || {}
  const launch = content.launch.map((t: any) => `${done[t.id] ? '✓' : dayN && dayN > t.end ? '✗late' : '·'} D${t.day}${t.end !== t.day ? `-${t.end}` : ''} ${t.title}`)

  // Money: this month and last month, base currency.
  const cur = content.finance.currency
  const months: Record<string, any> = {}
  for (const t of money ?? []) {
    const m = t.occurred_on.slice(0, 7)
    months[m] ??= { spent: 0, income: 0, byCategory: {}, other: {} }
    if (t.currency !== cur) {
      months[m].other[`${t.kind} ${t.currency}`] = (months[m].other[`${t.kind} ${t.currency}`] ?? 0) + Number(t.amount)
      continue
    }
    if (t.kind === 'expense') {
      months[m].spent += Number(t.amount)
      months[m].byCategory[t.category] = (months[m].byCategory[t.category] ?? 0) + Number(t.amount)
    } else months[m].income += Number(t.amount)
  }

  const week = start ? Math.min(content.wealthWeeks.length, Math.max(1, Math.floor(((dayN ?? 1) - 1) / 7) + 1)) : null

  return {
    now: now.label,
    plan: `${plan} (${content.plans[plan].name})`,
    currentBlock: current ? `${current.start}-${current.end} ${current.title}` : 'gap',
    today: today.map((b: any) => `${b.start}-${b.end} ${b.title} [${b.pillar}]`),
    weeklyHoursByCategory: weekHours,
    profile: content.profile,
    scorecard: { trackingSince: firstDay, trackedDays, winRule: `${content.scorecardWin}/${items.length} ticks`, ratesSinceTrackingStarted: rates, currentStreak: streak, todayTicks: items.filter((k: string) => (byDay[now.date] || {})[k]).length, last7DaysTicks: last7 },
    fiverr: { startDate: start, dayNumber: dayN, launch, gigs: content.gigs.map((g: any) => `#${g.n} ${g.name} ${g.price}`), levels: content.levels.map((l: any) => `${l.name}: ${l.req}`) },
    career: { certs: content.certs.map((c: any) => `${c.name} [${c.status}, ${c.when}]`), english: content.english.map((e: any) => e.t), domain: content.domain },
    roadmap: content.roadmap,
    content: { channels: content.channels.names, videosPerChannelPerDay: content.channels.videosPerChannelPerDay, rules: content.contentRules.slice(0, 3) },
    wealth: { currentWeek: week ? content.wealthWeeks[week - 1] : null, guardrails: content.wealthGuardrails },
    money: { currency: cur, monthlyBudget: content.finance.monthlyBudget, months },
  }
}

// ---------------------------------------------------------------- analysis
const INSIGHTS_PROMPT = (snapshot: any) => `You are Piyumal's personal growth strategist and career coach: direct, warm, specific, practical.
Piyumal is a DevOps engineer in Sri Lanka working on four fronts: career, Fiverr, four content channels and wealth.
Here is everything known right now (JSON):
${JSON.stringify(snapshot)}

Analyse it like a senior mentor. Use the real numbers. Never invent data; if something has no data yet, say so plainly and make starting it a suggestion.
Judge habits only over scorecard.trackedDays (tracking may have started very recently; if trackedDays is 1-3, treat it as a fresh start and encourage, do not scold).
Fiverr dayNumber below 1 means the launch has not started yet.
Look for: what is working, what is slipping, risks (sleep, burnout, late launch tasks, overspending), the single highest-leverage move this week,
and NEW ideas beyond the current plan (new gig ideas, content angles, certifications, projects, ways to earn, skills the market wants).

Reply with JSON only:
{"reply": "2-4 sentence headline assessment",
 "highlights": ["3-6 short bullets: wins and risks, with numbers"],
 "suggestions": [{"title": "short", "area": "career|fiverr|content|wealth|health|habits", "why": "one sentence tied to the data", "action": "an instruction the ASCEND site assistant can execute to update the site (e.g. 'Add \\"Book SAA-C03 exam\\" to the Dec 2026 roadmap'), or empty string if it is a real-world action only"}]}
Give 4-7 suggestions, ordered by impact.`

export async function runInsights(ask: AskJSON, snapshot: any, question: string, used: any) {
  const result = await ask(INSIGHTS_PROMPT(snapshot), [{ role: 'user', content: question || 'Analyse my progress and tell me what to do next.' }], used, 'medium', 4096)
  const suggestions = (Array.isArray(result?.suggestions) ? result.suggestions : []).slice(0, 8).map((s: any) => ({
    title: String(s.title ?? '').slice(0, 120),
    area: String(s.area ?? '').slice(0, 20),
    why: String(s.why ?? '').slice(0, 300),
    action: String(s.action ?? '').slice(0, 300),
  })).filter((s: any) => s.title)
  return {
    reply: String(result?.reply ?? '').slice(0, 1200),
    highlights: (Array.isArray(result?.highlights) ? result.highlights : []).slice(0, 8).map((h: any) => String(h).slice(0, 240)),
    suggestions,
  }
}

// ---------------------------------------------------------------- news (Gemini + Google Search)
function extractJSON(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.search(/[[{]/)
  if (start < 0) throw new Error('No JSON in news response')
  return JSON.parse(body.slice(start, Math.max(body.lastIndexOf(']'), body.lastIndexOf('}')) + 1))
}

async function newsViaGroq(groqKey: string, prompt: string) {
  const errors: string[] = []
  // Groq's built-in web search: "compound" models (if the account has them), then gpt-oss with browser_search.
  let ids: string[] = []
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${groqKey}` }, signal: AbortSignal.timeout(8000) })
    if (r.ok) ids = ((await r.json()).data ?? []).map((m: any) => m.id)
  } catch { /* use the static list */ }
  const attempts: { model: string; tools?: unknown[] }[] = [
    ...ids.filter((id) => id.includes('compound')).map((model) => ({ model })),
    ...['openai/gpt-oss-120b', 'openai/gpt-oss-20b'].filter((m) => !ids.length || ids.includes(m)).map((model) => ({ model, tools: [{ type: 'browser_search' }] })),
  ]
  for (const a of attempts) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(90_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: a.model,
          temperature: 0.3,
          max_completion_tokens: 3000,
          ...(a.tools ? { tools: a.tools, tool_choice: 'required', reasoning_effort: 'low' } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`)
      const d = await r.json()
      const msg = d?.choices?.[0]?.message ?? {}
      const results = (msg.executed_tools ?? []).flatMap((t: any) => t?.search_results?.results ?? t?.browser_results ?? [])
      const sources = results.filter((x: any) => x?.url).slice(0, 12).map((x: any) => ({ title: String(x.title ?? x.url).slice(0, 120), url: x.url }))
      return { items: extractJSON(String(msg.content ?? '')), sources, model: a.model }
    } catch (e) {
      errors.push(`${a.model}: ${(e as Error).message}`)
    }
  }
  throw new Error(errors.join(' | ') || 'no Groq search model available')
}

function cleanItems(raw: any[]) {
  // Drop anything dated before this year: the digest is about what is new.
  const year = new Date().getUTCFullYear()
  const recent = raw.filter((n) => { const y = Number(String(n?.date ?? '').match(/(20\d\d)/)?.[1]); return !y || y >= year })
  return recent.slice(0, 10).map((n) => ({
    headline: String(n.headline ?? '').slice(0, 200),
    date: String(n.date ?? '').slice(0, 20),
    topic: String(n.topic ?? '').slice(0, 60),
    why: String(n.why ?? '').slice(0, 400),
    action: String(n.action ?? '').slice(0, 300),
    url: /^https?:\/\//.test(String(n.url ?? '')) ? String(n.url) : '',
  })).filter((n) => n.headline)
}

export async function runNews(geminiKey: string, models: string[], profile: any, focus: string, groqKey = '') {
  const today = colomboNow().date
  const prompt = `Today is ${today}. Use Google Search to find the most important news and updates from roughly the last 30 days for this person:
${JSON.stringify({ role: profile.role, location: profile.location, skills: profile.skills, goals: profile.goals, topics: profile.newsTopics })}
${focus ? `Focus especially on: ${focus}\n` : ''}Pick 6-8 items that genuinely matter for their career, freelancing, content channels or finances. Prefer official sources.
For each item explain specifically why it matters to Piyumal and one concrete action.
Return ONLY a JSON array in a \`\`\`json block:
[{"headline": "...", "date": "YYYY-MM-DD or month", "topic": "...", "why": "1-2 sentences for Piyumal", "action": "one concrete step", "url": "source URL if known"}]`
  const errors: string[] = []
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      })
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
      const d = await r.json()
      const cand = d?.candidates?.[0]
      const text = cand?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? ''
      const items = cleanItems(extractJSON(text) as any[])
      const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
        .map((c: any) => c.web).filter((w: any) => w?.uri)
        .slice(0, 12).map((w: any) => ({ title: String(w.title ?? w.uri).slice(0, 120), url: w.uri }))
      if (!items.length) throw new Error('empty news list')
      return { items, sources, model }
    } catch (e) {
      errors.push(`${model}: ${(e as Error).message}`)
    }
  }
  if (groqKey) {
    try {
      const g = await newsViaGroq(groqKey, prompt)
      const items = cleanItems(Array.isArray(g.items) ? g.items : [])
      if (items.length) return { items, sources: g.sources, model: g.model }
      errors.push('groq: empty news list')
    } catch (e) {
      errors.push(`groq: ${(e as Error).message}`)
    }
  }
  throw new Error(`News search failed. ${errors.map((e) => e.replace(/\s+/g, ' ').slice(0, 160)).join(' | ')}`)
}

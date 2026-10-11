// Shared by the web app (Vite) and the AI edge function (Deno). Pure ESM, no dependencies.
//
// Defines every editable section of the site content, how to validate it, and helpers to
// read/write sections by dot path ("schedule.A.weekday", "roadmap", ...).

// ---------------------------------------------------------------- tiny schema DSL
const T = {
  str: (max = 2000, min = 0) => ({ t: 'str', max, min }),
  num: (min = -1e9, max = 1e9) => ({ t: 'num', min, max }),
  bool: () => ({ t: 'bool' }),
  time: () => ({ t: 'time' }),
  color: () => ({ t: 'color' }),
  pillar: () => ({ t: 'pillar' }),
  key: () => ({ t: 'key' }),
  arr: (of, max = 200, min = 0) => ({ t: 'arr', of, max, min }),
  obj: (fields) => ({ t: 'obj', fields }),
  opt: (spec) => ({ ...spec, optional: true }),
  dict: (of, max = 50) => ({ t: 'dict', of, max }),
  oneOf: (values) => ({ t: 'enum', values }),
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const KEY_RE = /^[a-z][a-z0-9_]{0,30}$/

function check(spec, value, path, ctx, errors) {
  if (value === undefined || value === null) {
    if (!spec.optional) errors.push(`${path}: required`)
    return
  }
  switch (spec.t) {
    case 'str':
      if (typeof value !== 'string') return errors.push(`${path}: must be text`)
      if (value.length > spec.max) errors.push(`${path}: longer than ${spec.max} characters`)
      if (value.trim().length < spec.min) errors.push(`${path}: must not be empty`)
      return
    case 'num':
      if (typeof value !== 'number' || !Number.isFinite(value)) return errors.push(`${path}: must be a number`)
      if (value < spec.min || value > spec.max) errors.push(`${path}: must be between ${spec.min} and ${spec.max}`)
      return
    case 'bool':
      if (typeof value !== 'boolean') errors.push(`${path}: must be true/false`)
      return
    case 'time':
      if (typeof value !== 'string' || !TIME_RE.test(value)) errors.push(`${path}: must be a 24h time like 04:30`)
      return
    case 'color':
      if (typeof value !== 'string' || !COLOR_RE.test(value)) errors.push(`${path}: must be a colour like #4cc9f0`)
      return
    case 'key':
      if (typeof value !== 'string' || !KEY_RE.test(value)) errors.push(`${path}: must be a lowercase id like "career"`)
      return
    case 'pillar':
      if (typeof value !== 'string' || !ctx.pillars.has(value)) {
        errors.push(`${path}: unknown category "${value}" (use one of: ${[...ctx.pillars].join(', ')})`)
      }
      return
    case 'enum':
      if (!spec.values.includes(value)) errors.push(`${path}: must be one of ${spec.values.join(', ')}`)
      return
    case 'arr':
      if (!Array.isArray(value)) return errors.push(`${path}: must be a list`)
      if (value.length > spec.max) errors.push(`${path}: more than ${spec.max} items`)
      if (value.length < spec.min) errors.push(`${path}: needs at least ${spec.min} item(s)`)
      value.forEach((v, i) => check(spec.of, v, `${path}[${i}]`, ctx, errors))
      return
    case 'obj': {
      if (typeof value !== 'object' || Array.isArray(value)) return errors.push(`${path}: must be an object`)
      for (const [k, s] of Object.entries(spec.fields)) check(s, value[k], `${path}.${k}`, ctx, errors)
      for (const k of Object.keys(value)) {
        if (!(k in spec.fields)) errors.push(`${path}.${k}: unknown field`)
      }
      return
    }
    case 'dict': {
      if (typeof value !== 'object' || Array.isArray(value)) return errors.push(`${path}: must be an object`)
      const keys = Object.keys(value)
      if (keys.length > spec.max) errors.push(`${path}: more than ${spec.max} entries`)
      for (const k of keys) check(spec.of, value[k], `${path}.${k}`, ctx, errors)
      return
    }
    default:
      errors.push(`${path}: unknown schema type`)
  }
}

// ---------------------------------------------------------------- section specs
const BLOCK_OVERRIDE = T.obj({ title: T.opt(T.str(120, 1)), pillar: T.opt(T.pillar()), detail: T.opt(T.str(600)) })

const BLOCK = T.obj({
  start: T.time(),
  end: T.time(),
  title: T.str(120, 1),
  pillar: T.pillar(),
  detail: T.str(600),
  // Weekday-only rotations: "1" = Monday … "5" = Friday ("0" Sunday, "6" Saturday).
  byDay: T.opt(T.dict(BLOCK_OVERRIDE, 7)),
})

const DAY = T.arr(BLOCK, 40, 1)

const SECTION_TEXT = T.obj({ kicker: T.str(80), title: T.str(120, 1), intro: T.str(600) })

export const SECTIONS = {
  site: {
    label: 'Site texts: hero, section titles, footer',
    spec: T.obj({
      brand: T.str(30, 1),
      eyebrow: T.str(120),
      title: T.str(30, 1),
      lede: T.str(400),
      footerQuote: T.str(160),
      footerNote: T.str(200),
      sleepNote: T.str(800),
      sections: T.obj({
        timetable: SECTION_TEXT,
        fronts: SECTION_TEXT,
        legends: SECTION_TEXT,
        roadmap: SECTION_TEXT,
        scorecard: SECTION_TEXT,
      }),
    }),
  },
  pillars: {
    label: 'Categories (colour, label, icon) used by every block',
    spec: T.dict(T.obj({ label: T.str(40, 1), color: T.color(), icon: T.str(4, 1) }), 20),
  },
  coreFour: { label: 'The four main goals (planet orbits, front tabs)', spec: T.arr(T.pillar(), 6, 1) },
  plans: {
    label: 'Plan names (Plan A now / Plan B bike)',
    spec: T.obj({
      A: T.obj({ name: T.str(40, 1), sub: T.str(80), short: T.str(20, 1) }),
      B: T.obj({ name: T.str(40, 1), sub: T.str(80), short: T.str(20, 1) }),
    }),
  },
  'schedule.A.weekday': { label: 'Plan A (no bike) Monday–Friday timetable', spec: DAY },
  'schedule.A.saturday': { label: 'Plan A Saturday timetable', spec: DAY },
  'schedule.A.sunday': { label: 'Plan A Sunday timetable', spec: DAY },
  'schedule.B.weekday': { label: 'Plan B (bike + gym) Monday–Friday timetable', spec: DAY },
  'schedule.B.saturday': { label: 'Plan B Saturday timetable', spec: DAY },
  'schedule.B.sunday': { label: 'Plan B Sunday timetable', spec: DAY },
  'schedule.overrides': {
    label: 'One-off full-day replacements, e.g. a special Wednesday. Keys "A-3" = Plan A Wednesday (0=Sun … 6=Sat)',
    spec: T.dict(DAY, 14),
  },
  fronts: {
    label: 'Four-front tab cards (headline, stat, blurb per goal)',
    spec: T.dict(T.obj({ headline: T.str(80, 1), stat: T.str(60), blurb: T.str(200) }), 10),
  },
  certs: {
    label: 'Certification ladder',
    spec: T.arr(T.obj({ name: T.str(120, 1), status: T.oneOf(['done', 'now', 'next', 'later']), when: T.str(40), why: T.str(300) }), 20),
  },
  english: { label: 'Spoken English system', spec: T.arr(T.obj({ t: T.str(60, 1), d: T.str(300) }), 15) },
  domain: { label: 'Domain knowledge topics', spec: T.arr(T.str(160, 1), 20) },
  gigs: {
    label: 'Fiverr gigs in publish order',
    spec: T.arr(T.obj({ n: T.num(1, 50), id: T.str(10, 1), name: T.str(100, 1), price: T.str(30), tag: T.str(30), note: T.str(200) }), 30),
  },
  launch: {
    label: 'Fiverr launch checklist (day offsets from Day 1)',
    spec: T.arr(T.obj({ id: T.str(20, 1), day: T.num(1, 400), end: T.num(1, 400), title: T.str(120, 1), detail: T.str(400) }), 40),
  },
  fiverrRules: { label: 'Fiverr rules', spec: T.arr(T.str(200, 1), 20) },
  levels: { label: 'Fiverr seller levels', spec: T.arr(T.obj({ name: T.str(30, 1), req: T.str(160), unlock: T.str(80) }), 8) },
  channels: {
    label: 'Content channels A–D: channel names (names.A … names.D), suggestions, videos per day',
    spec: T.obj({
      names: T.opt(T.obj({ A: T.str(60), B: T.str(60), C: T.str(60), D: T.str(60) })),
      videosPerChannelPerDay: T.num(0, 20),
      suggestions: T.arr(T.str(120), 8, 1),
      batchNote: T.str(400),
    }),
  },
  contentPipeline: { label: 'AI video production pipeline', spec: T.arr(T.obj({ step: T.str(30, 1), tool: T.str(120), time: T.str(10) }), 12) },
  contentRules: { label: 'Content monetization rules', spec: T.arr(T.str(300, 1), 15) },
  wealthWeeks: { label: 'Wealth research curriculum (weeks)', spec: T.arr(T.obj({ w: T.num(1, 104), t: T.str(60, 1), d: T.str(300) }), 52) },
  wealthGuardrails: { label: 'Wealth guardrails', spec: T.arr(T.str(200, 1), 15) },
  roadmap: { label: 'Roadmap milestones', spec: T.arr(T.obj({ when: T.str(30, 1), items: T.arr(T.str(120, 1), 12, 1) }), 24) },
  scorecard: {
    label: 'Daily scorecard checklist items',
    spec: T.arr(T.obj({ id: T.key(), label: T.str(60, 1), pillar: T.pillar() }), 15, 1),
  },
  scorecardWin: { label: 'How many ticks count as a won day', spec: T.num(1, 15) },
  legends: {
    label: 'Successful people research cards',
    spec: T.arr(T.obj({ name: T.str(60, 1), role: T.str(80), wake: T.str(20), habit: T.str(500), yours: T.str(300), quote: T.opt(T.str(200)) }), 30),
  },
  profile: {
    label: 'About Piyumal: role, location, experience, skills, certifications earned, goals and interests (used by the assistant for advice and news)',
    spec: T.obj({
      name: T.str(60, 1),
      role: T.str(120),
      location: T.str(60),
      summary: T.str(800),
      experience: T.arr(T.str(200, 1), 15),
      skills: T.arr(T.str(60, 1), 60),
      certificationsEarned: T.arr(T.str(120, 1), 20),
      goals: T.arr(T.str(200, 1), 20),
      interests: T.arr(T.str(80, 1), 30),
      newsTopics: T.arr(T.str(80, 1), 20),
    }),
  },
  finance: {
    label: 'Money tracker settings: base currency, monthly budget, expense and income categories (with optional per-category budgets)',
    spec: T.obj({
      currency: T.str(3, 3),
      monthlyBudget: T.num(0, 1e9),
      categories: T.arr(T.obj({ key: T.key(), label: T.str(40, 1), color: T.color(), icon: T.str(4, 1), budget: T.opt(T.num(0, 1e9)) }), 30, 1),
      incomeCategories: T.arr(T.obj({ key: T.key(), label: T.str(40, 1), color: T.color(), icon: T.str(4, 1) }), 15, 1),
    }),
  },
  principles: { label: 'Principles under the legends', spec: T.arr(T.obj({ k: T.str(60, 1), v: T.str(300) }), 12) },
}

export const SECTION_IDS = Object.keys(SECTIONS)

// ---------------------------------------------------------------- path helpers
export function getAt(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setAt(obj, path, value) {
  const keys = path.split('.')
  const root = structuredClone(obj)
  let o = root
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {}
    o = o[keys[i]]
  }
  o[keys[keys.length - 1]] = value
  return root
}

// ---------------------------------------------------------------- validation
/** Validate one section value in the context of the full content (for pillar lookups). */
export function validateSection(id, value, content) {
  const def = SECTIONS[id]
  if (!def) return [`Unknown section "${id}"`]
  const pillarsSource = id === 'pillars' ? value : content.pillars
  const ctx = { pillars: new Set(Object.keys(pillarsSource || {})) }
  const errors = []
  check(def.spec, value, id, ctx, errors)
  if (id === 'pillars') {
    for (const k of Object.keys(value || {})) if (!KEY_RE.test(k)) errors.push(`pillars.${k}: id must be lowercase letters`)
  }
  if (id.startsWith('schedule.') && Array.isArray(value)) checkDay(id, value, errors)
  if (id === 'schedule.overrides' && value && typeof value === 'object') {
    for (const [k, day] of Object.entries(value)) {
      if (!/^[AB]-[0-6]$/.test(k)) errors.push(`schedule.overrides.${k}: key must look like "A-3"`)
      if (Array.isArray(day)) checkDay(`schedule.overrides.${k}`, day, errors)
    }
  }
  return errors
}

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// A day must have no overlapping blocks (sleep may wrap past midnight).
function checkDay(path, blocks, errors) {
  const valid = blocks.filter((b) => b && TIME_RE.test(b.start) && TIME_RE.test(b.end))
  if (valid.length !== blocks.length) return
  const sorted = [...valid].sort((a, b) => toMin(a.start) - toMin(b.start))
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]
    const s = toMin(b.start)
    const e = toMin(b.end)
    if (s === e) errors.push(`${path}: "${b.title}" starts and ends at the same time`)
    const wraps = e < s
    if (wraps && i !== sorted.length - 1) errors.push(`${path}: only the last block of the day (sleep) may run past midnight ("${b.title}")`)
    const next = sorted[i + 1]
    if (next && !wraps && toMin(next.start) < e) {
      errors.push(`${path}: "${b.title}" (${b.start}–${b.end}) overlaps "${next.title}" (${next.start})`)
    }
  }
}

/** Validate the whole document. Returns a list of human-readable errors (empty = valid). */
export function validateContent(content) {
  if (!content || typeof content !== 'object') return ['Content must be an object']
  const errors = []
  for (const id of SECTION_IDS) errors.push(...validateSection(id, getAt(content, id), content))
  return errors
}

// ---------------------------------------------------------------- diff (for previews)
/** Flat list of changed leaf paths between two values: [{ path, before, after }]. */
export function diffValues(before, after, path = '', out = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return out
  const isObj = (v) => v && typeof v === 'object'
  if (isObj(before) && isObj(after) && Array.isArray(before) === Array.isArray(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const k of keys) diffValues(before[k], after[k], path ? `${path}.${k}` : k, out)
    return out
  }
  out.push({ path, before, after })
  return out
}

// ---------------------------------------------------------------- defaults
/**
 * Fill sections and fixed object fields that an older document lacks, guided by the schema.
 * Lists and dictionaries are never merged, so items the user deleted do not come back.
 */
export function fillDefaults(content, defaults) {
  const fill = (spec, value, def) => {
    if (value === undefined || value === null) return def === undefined ? value : structuredClone(def)
    if (spec?.t === 'obj' && value && typeof value === 'object' && !Array.isArray(value) && def && typeof def === 'object') {
      const out = { ...value }
      for (const [k, s] of Object.entries(spec.fields)) {
        const filled = fill(s, value[k], def[k])
        if (filled !== undefined) out[k] = filled
      }
      return out
    }
    return value
  }
  let out = content || {}
  for (const id of SECTION_IDS) {
    const current = getAt(out, id)
    const next = fill(SECTIONS[id].spec, current, getAt(defaults, id))
    if (next !== current) out = setAt(out, id, next)
  }
  return out
}

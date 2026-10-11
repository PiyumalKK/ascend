// The default content document. Seeds the database on first owner sign-in and is the
// fallback whenever the database cannot be reached. After seeding, the database is the
// source of truth and these files are only defaults.
import { PILLARS, CORE_FOUR } from './pillars'
import { RAW_SCHEDULE, PLANS } from './schedule'
import { GIGS, LAUNCH, FIVERR_RULES, LEVELS } from './fiverr'
import {
  CERTS, ENGLISH, DOMAIN, CONTENT_PIPELINE, CONTENT_RULES, CHANNEL_SUGGESTIONS,
  WEALTH_WEEKS, WEALTH_GUARDRAILS, ROADMAP, SCORECARD,
} from './growth'
import { LEGENDS, PRINCIPLES } from './legends'

// Normalise a template block: fold byDayDetail into byDay and drop empty fields.
function cleanBlock(b) {
  const out = { start: b.start, end: b.end, title: b.title, pillar: b.pillar, detail: b.detail || '' }
  const byDay = {}
  for (const [d, v] of Object.entries(b.byDay || {})) byDay[d] = { ...v }
  for (const [d, v] of Object.entries(b.byDayDetail || {})) byDay[d] = { ...(byDay[d] || {}), detail: v }
  if (Object.keys(byDay).length) out.byDay = byDay
  return out
}

function cleanPlan(p) {
  return {
    weekday: p.weekday.map(cleanBlock),
    saturday: p.saturday.map(cleanBlock),
    sunday: p.sunday.map(cleanBlock),
  }
}

export const DEFAULT_CONTENT = {
  schemaVersion: 1,
  site: {
    brand: 'ASCEND',
    eyebrow: 'Piyumal Ranasinghe · Operating System v1',
    title: 'ASCEND',
    // {pillar|text} renders `text` in that pillar's colour.
    lede: '04:00 → 22:00. One engineer, four fronts: {career|career}, {fiverr|Fiverr}, {content|four channels} and {wealth|wealth}. Built on the daily habits of men who made it.',
    footerQuote: '“Discipline equals freedom.”',
    footerNote: 'Built for Piyumal Ranasinghe · DevOps Engineer · Colombo · 04:00 → 22:00',
    sleepNote:
      'About the 6 hours of sleep. Your 22:00 → 04:00 window is the same one Franklin used, but research says most adults do best on 7+. That is why the plan includes a weekend nap, Sunday rest, and a lights-out rule that never moves. If your energy drops for a week straight, move the alarm to 04:30 before you give up anything else.',
    sections: {
      timetable: {
        kicker: '01 · The timetable',
        title: 'Every hour has a job',
        intro: 'Two protected deep-work blocks a day, the hardest work first, content batched on weekends, and recovery scheduled like a meeting. Tap any block on the dial or the list.',
      },
      fronts: {
        kicker: '02 · The four fronts',
        title: 'Where the hours go',
        intro: 'Each front has a plan you can tick off. Progress syncs to your account.',
      },
      legends: {
        kicker: '03 · Research',
        title: 'How successful men built their days',
        intro: 'Eleven lives, one pattern: early starts, the hard work first, deep focus, constant reading and protected recovery. Each card shows the habit and where it lives in your timetable.',
      },
      roadmap: {
        kicker: '04 · Twelve months',
        title: 'The road to October 2027',
        intro: 'Targets, not promises. Check them in your Sunday Think Hour and adjust the next quarter, never the vision.',
      },
      scorecard: {
        kicker: '05 · Daily scorecard',
        title: 'Win the day, nine times',
        intro: 'Tick these during your shutdown ritual. Seven out of nine counts as a won day. Synced across your devices.',
      },
    },
  },
  pillars: Object.fromEntries(Object.values(PILLARS).map((p) => [p.key, { label: p.label, color: p.color, icon: p.icon }])),
  coreFour: [...CORE_FOUR],
  plans: {
    A: { name: PLANS.A.name, sub: PLANS.A.sub, short: 'No bike' },
    B: { name: PLANS.B.name, sub: PLANS.B.sub, short: 'Bike + gym' },
  },
  schedule: {
    A: cleanPlan(RAW_SCHEDULE.A),
    B: cleanPlan(RAW_SCHEDULE.B),
    overrides: {},
  },
  fronts: {
    career: { headline: 'Become the senior engineer', stat: 'SAA-C03 → Expert', blurb: 'Spoken English, deeper domain knowledge and a certification ladder.' },
    fiverr: { headline: 'Engineer account, Level 1 in 60 days', stat: '10 gigs · $45 → $1,600', blurb: 'Convert the design account into an engineering one, following PLAN-10.' },
    content: { headline: 'Four channels, 28 videos a week', stat: 'A · B · C · D', blurb: 'AI-assisted, batched on weekends, original enough to monetize.' },
    wealth: { headline: 'Research before rupees', stat: '12-week curriculum', blurb: 'E-money, crypto and business models, studied with guardrails.' },
  },
  certs: CERTS.map((c) => ({ ...c })),
  english: ENGLISH.map((e) => ({ ...e })),
  domain: [...DOMAIN],
  gigs: GIGS.map((g) => ({ ...g })),
  launch: LAUNCH.map((l) => ({ ...l })),
  fiverrRules: [...FIVERR_RULES],
  levels: LEVELS.map((l) => ({ ...l })),
  channels: {
    names: { A: '', B: '', C: '', D: '' },
    videosPerChannelPerDay: 1,
    suggestions: [...CHANNEL_SUGGESTIONS],
    batchNote: 'Made in two factories: Saturday 08:30–12:00 and Sunday 08:00–11:30, then everything is scheduled in Meta Business Suite. Weekdays you only check the queue and reply to comments (10 minutes).',
  },
  contentPipeline: CONTENT_PIPELINE.map((p) => ({ ...p })),
  contentRules: [...CONTENT_RULES],
  wealthWeeks: WEALTH_WEEKS.map((w) => ({ ...w })),
  wealthGuardrails: [...WEALTH_GUARDRAILS],
  roadmap: ROADMAP.map((r) => ({ when: r.when, items: [...r.items] })),
  scorecard: SCORECARD.map((s) => ({ ...s })),
  scorecardWin: 7,
  legends: LEGENDS.map((l) => {
    const { quote, ...rest } = l
    return quote ? { ...rest, quote } : rest
  }),
  principles: PRINCIPLES.map((p) => ({ ...p })),
  profile: {
    name: 'Piyumal Ranasinghe',
    role: 'DevOps Engineer · Cloud & Multi-Cloud Engineer · Agentic AI',
    location: 'Colombo, Sri Lanka',
    summary: 'DevOps and cloud engineer building production multi-cloud infrastructure on AWS and Azure with Terraform, Docker, Ansible and CI/CD (GitLab CI, GitHub Actions). Builds multi-agent AI systems on Azure AI Foundry with MCP and RAG. B.Sc. Eng. (Hons) Computer Engineering, University of Ruhuna (2021–2026, SGPA 3.53).',
    experience: [
      'DevOps Engineer intern, GTN Tech (fintech), May–Nov 2025: Terraform modules, multi-env platform, GitLab CI/CD, ECS/Fargate, Datadog/Grafana',
      'Now: full-time DevOps engineer, office in Colombo',
      'DevOps Commander: 5-agent self-healing ops platform on Azure AI Foundry with MCP tools and RAG',
      'HealthSync and ShopEase: Terraform-managed Azure microservice platforms',
      'ZK Voting: zero-knowledge blockchain voting research (Noir, Solidity)',
      'IEEEXtreme 18.0: 11th of 8,500+ teams',
      '250+ graphic design and video client projects (2021–2025)',
    ],
    skills: ['AWS', 'Azure', 'Terraform', 'Docker', 'Kubernetes (AKS/EKS)', 'GitHub Actions', 'GitLab CI', 'Ansible', 'Python', 'Bash', 'Datadog', 'Grafana', 'Azure AI Foundry', 'MCP', 'RAG', 'Multi-agent AI', 'React', 'Next.js'],
    certificationsEarned: ['AZ-900 Azure Fundamentals', 'AZ-104 Azure Administrator', 'AI-102 Azure AI Engineer', 'AI-103 Azure AI Apps & Agents Developer'],
    goals: [
      'Become a senior DevOps / platform engineer',
      'Speak English fluently and confidently at work',
      'Pass AWS SAA-C03, then Terraform Associate, AZ-400, CKA',
      'Reach Fiverr Level 1, then Level 2, with engineering gigs',
      'Monetize four AI-assisted Facebook channels',
      'Build wealth carefully: research e-money, crypto and business models',
    ],
    interests: ['Platform engineering', 'AI agents and MCP', 'Cloud cost optimisation', 'Blockchain and zero-knowledge', 'Freelancing', 'Content creation'],
    newsTopics: [
      'AWS and Azure announcements relevant to DevOps',
      'Terraform, Kubernetes and platform engineering',
      'AI agents, MCP and Claude Code',
      'Cloud and DevOps certification changes',
      'Fiverr seller and freelancing updates',
      'Facebook content monetization rules',
      'Sri Lanka tech jobs, freelancing tax and Central Bank rules',
    ],
  },
  finance: {
    currency: 'LKR',
    monthlyBudget: 0,
    categories: [
      { key: 'food', label: 'Food & dining', color: '#f4a261', icon: '🍛' },
      { key: 'transport', label: 'Transport', color: '#7d8bb0', icon: '🚌' },
      { key: 'bills', label: 'Bills & utilities', color: '#4cc9f0', icon: '💡' },
      { key: 'family', label: 'Family & home', color: '#ff8fab', icon: '🏠' },
      { key: 'health', label: 'Health & gym', color: '#ff6b6b', icon: '💪' },
      { key: 'learning', label: 'Courses & certs', color: '#3a86ff', icon: '🎓' },
      { key: 'tools', label: 'Software & AI tools', color: '#b388ff', icon: '🛠' },
      { key: 'shopping', label: 'Shopping', color: '#ff4fd8', icon: '🛍' },
      { key: 'fun', label: 'Entertainment', color: '#ffc857', icon: '🎬' },
      { key: 'other', label: 'Other', color: '#8f97b8', icon: '•' },
    ],
    incomeCategories: [
      { key: 'salary', label: 'Salary', color: '#1dbf73', icon: '💼' },
      { key: 'fiverr', label: 'Fiverr', color: '#1dbf73', icon: '▲' },
      { key: 'content', label: 'Content payouts', color: '#ff4fd8', icon: '●' },
      { key: 'other_income', label: 'Other income', color: '#8f97b8', icon: '+' },
    ],
  },
}

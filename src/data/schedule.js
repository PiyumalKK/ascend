// Timetable data.
// Plan A = now (no bike): leave 06:00, home ~18:00, real work starts ~19:30.
// Plan B = after the bike: leave 07:30, gym every morning.
// Times are 24h "HH:MM". A block may carry `byDay` (0=Sun … 6=Sat) to rotate its focus.

const DW1_FOCUS = {
  1: { title: 'Deep Work I · Fiverr build', pillar: 'fiverr', detail: 'Build delivery templates, gig galleries, gig copy. The hardest creative work happens before the world wakes up.' },
  2: { title: 'Deep Work I · AWS SAA-C03', pillar: 'career', detail: 'One exam domain per session: read, then 20 practice questions, then write down every mistake.' },
  3: { title: 'Deep Work I · Fiverr build', pillar: 'fiverr', detail: 'Ship one asset: a template, a gig image, a video script, or a delivery playbook.' },
  4: { title: 'Deep Work I · AWS SAA-C03', pillar: 'career', detail: 'Hands-on lab in a free-tier account. Build it, break it, write a 5-line note.' },
  5: { title: 'Deep Work I · Fiverr growth', pillar: 'fiverr', detail: 'Weekly gig check: impressions → clicks → orders. Change ONE thing, then wait 14 days.' },
}

const ENGLISH_LAB = {
  1: 'Record a 2-minute video explaining one DevOps concept in English. Watch it back once.',
  2: 'Talk to an AI voice tutor for 20 minutes about your workday. Ask it to correct you.',
  3: 'Shadowing: copy a native tech speaker sentence by sentence (conference talk or podcast).',
  4: 'Mock interview: answer 3 behavioural questions out loud using STAR format.',
  5: 'Write and post one LinkedIn post in English about something you built this week.',
}

const PRAYER = { title: 'Wash & prayer', pillar: 'mind', detail: 'Your 30 minutes. Phone stays in the other room.' }
const SHUTDOWN = {
  title: 'Shutdown ritual',
  pillar: 'mind',
  detail: 'Ask Franklin’s evening question: “What good have I done today?” Tick the scorecard, write tomorrow’s top 3, phone out of the bedroom.',
}
const SLEEP = { title: 'Sleep', pillar: 'sleep', detail: '6 hours on weekdays is your floor, not a target. Lights out at 22:00 sharp: the 04:00 alarm depends on it.' }

// ---------- PLAN A · weekdays (no bike) ----------
const weekdayA = [
  { start: '04:00', end: '04:10', title: 'Wake · water · stillness', pillar: 'mind', detail: 'No snooze. Feet on the floor within 5 seconds. A glass of water, a short prayer, then read your 3 targets for today.' },
  { start: '04:10', end: '05:20', byDay: DW1_FOCUS, title: 'Deep Work I', pillar: 'fiverr', detail: '' },
  { start: '05:20', end: '05:35', title: 'Move · 15 min bodyweight', pillar: 'body', detail: 'Push-ups, squats, plank, stretch. A small daily dose until the gym arrives with the bike.' },
  { start: '05:35', end: '05:45', title: 'Content queue A·B·C·D', pillar: 'content', detail: 'Confirm today’s 4 scheduled videos are live. Reply to the 3 best comments on each channel.' },
  { start: '05:45', end: '06:00', title: 'Shower · ready · leave', pillar: 'life', detail: 'Lay out clothes and bag the night before so this takes 15 minutes, not 30.' },
  { start: '06:00', end: '07:00', title: 'Commute · audio university', pillar: 'commute', detail: 'English podcast (BBC 6 Minute English, then tech podcasts) or AWS video lectures. Earbuds in, 2× learning time.' },
  { start: '07:00', end: '17:00', title: 'Office · be the best engineer there', pillar: 'office', detail: 'Speak at least once in every meeting. Ask one smart question a day. Lunch: 15 minutes for the Fiverr inbox (the 15-minute reply rule).' },
  { start: '17:00', end: '18:00', title: 'Commute · review & reply', pillar: 'commute', detail: 'Fiverr buyer replies on the app, 10 Anki vocabulary cards, then rest your eyes.' },
  { start: '18:00', end: '18:30', ...PRAYER },
  { start: '18:30', end: '19:30', title: 'Dinner · family · decompress', pillar: 'life', detail: 'Fully present. This hour is what makes the 4 AM alarm sustainable.' },
  { start: '19:30', end: '20:45', title: 'Deep Work II · Fiverr orders', pillar: 'fiverr', detail: 'Active orders first, then buyer requests, then gig improvements. Deliver early; over-deliver on the first 10 orders.' },
  { start: '20:45', end: '21:15', byDayDetail: ENGLISH_LAB, title: 'English speaking lab', pillar: 'career', detail: '' },
  { start: '21:15', end: '21:40', title: 'Wealth research · 25 min', pillar: 'wealth', detail: 'This week’s topic from the 12-week curriculum. Read, then write 3 lines of notes. No buying anything from a video.' },
  { start: '21:40', end: '22:00', ...SHUTDOWN },
  { start: '22:00', end: '04:00', ...SLEEP },
]

// ---------- PLAN B · weekdays (bike + gym) ----------
const weekdayB = [
  { start: '04:00', end: '04:10', title: 'Wake · water · stillness', pillar: 'mind', detail: 'No snooze. A glass of water, a short prayer, then read your 3 targets for today.' },
  { start: '04:10', end: '05:40', byDay: DW1_FOCUS, title: 'Deep Work I', pillar: 'fiverr', detail: '' },
  { start: '05:40', end: '06:45', title: 'Gym', pillar: 'body', detail: 'Push / Pull / Legs rotation, 3 days strength + 2 days conditioning. Log every lift and add a little each week.' },
  { start: '06:45', end: '07:10', title: 'Shower · protein breakfast', pillar: 'life', detail: 'Eggs, rice or oats, fruit. Fuel for a 10-hour day.' },
  { start: '07:10', end: '07:30', title: 'Content queue A·B·C·D', pillar: 'content', detail: 'Confirm today’s 4 videos are live. Reply to the top comments on each channel.' },
  { start: '07:30', end: '08:15', title: 'Ride to office', pillar: 'commute', detail: 'No earbuds on the bike. Use the ride as thinking time: rehearse one English sentence you will say today.' },
  { start: '08:15', end: '17:00', title: 'Office · be the best engineer there', pillar: 'office', detail: 'Speak at least once in every meeting. Lunch: 15 minutes Fiverr inbox + 15 minutes English podcast (you lost commute audio time).' },
  { start: '17:00', end: '17:45', title: 'Ride home', pillar: 'commute', detail: 'Ride safe. Nothing on Fiverr is worth checking at a red light.' },
  { start: '17:45', end: '18:15', ...PRAYER },
  { start: '18:15', end: '19:00', title: 'Dinner · family', pillar: 'life', detail: 'Fully present. Phone face down.' },
  { start: '19:00', end: '20:30', title: 'Deep Work II · Fiverr orders', pillar: 'fiverr', detail: 'You gained 30 minutes from the bike: use it for retainers and upsells, not just deliveries.' },
  { start: '20:30', end: '21:00', byDayDetail: ENGLISH_LAB, title: 'English speaking lab', pillar: 'career', detail: '' },
  { start: '21:00', end: '21:20', title: 'Domain drill · 20 questions', pillar: 'career', detail: 'Cert practice questions. Replaces the commute lectures you lost by riding.' },
  { start: '21:20', end: '21:40', title: 'Wealth research · 20 min', pillar: 'wealth', detail: 'This week’s curriculum topic. Read, then write 3 lines of notes.' },
  { start: '21:40', end: '22:00', ...SHUTDOWN },
  { start: '22:00', end: '04:00', ...SLEEP },
]

// ---------- Saturday ----------
const saturday = (bike) => [
  { start: '04:00', end: '04:15', title: 'Wake · water · stillness', pillar: 'mind', detail: 'Same alarm on weekends. Consistency is what makes 04:00 feel normal by week three.' },
  { start: '04:15', end: '06:45', title: 'Fiverr deep block · 2.5 h', pillar: 'fiverr', detail: 'The big build of the week: a new gig, a gallery, a video, or a reusable delivery template.' },
  bike
    ? { start: '06:45', end: '07:45', title: 'Gym · heavy day', pillar: 'body', detail: 'Your heaviest session of the week. You have time, so do not rush it.' }
    : { start: '06:45', end: '07:45', title: 'Run / brisk walk + bodyweight', pillar: 'body', detail: '30-minute run or walk, then 20 minutes of push-ups, squats and core.' },
  { start: '07:45', end: '08:30', title: 'Shower · breakfast', pillar: 'life', detail: '' },
  { start: '08:30', end: '12:00', title: 'Content Factory I · 14 videos', pillar: 'content', detail: 'Batch Monday to Wednesday plus half of Thursday for A·B·C·D: scripts → voice → visuals → edit → schedule. Use the pipeline, never improvise.' },
  { start: '12:00', end: '13:00', title: 'Lunch · 20-min nap', pillar: 'life', detail: 'The nap pays back the weekday sleep debt. Set an alarm and keep it under 25 minutes.' },
  { start: '13:00', end: '15:00', title: 'Certification study + lab', pillar: 'career', detail: 'Your current exam. Finish with one full timed practice set every 2nd Saturday.' },
  { start: '15:00', end: '16:00', title: 'English: real conversation', pillar: 'career', detail: 'An online speaking club, an English-only call with a friend, or recording a mock interview.' },
  { start: '16:00', end: '17:30', title: 'Free · friends · outdoors', pillar: 'life', detail: 'Planned rest. Elite performers schedule recovery the same way they schedule work.' },
  { start: '17:30', end: '18:00', ...PRAYER },
  { start: '18:00', end: '19:30', title: 'Fiverr orders & buyer briefs', pillar: 'fiverr', detail: 'Clear the inbox, deliver anything that is due, answer every buyer brief that matches your gigs.' },
  { start: '19:30', end: '20:30', title: 'Dinner · family', pillar: 'life', detail: '' },
  { start: '20:30', end: '21:30', title: 'Wealth deep dive · 1 h', pillar: 'wealth', detail: 'Go deep on this week’s topic and write a one-page summary you could explain to a friend.' },
  { start: '21:30', end: '22:00', ...SHUTDOWN },
  { start: '22:00', end: '04:00', ...SLEEP },
]

// ---------- Sunday ----------
const sunday = (bike) => [
  { start: '04:00', end: '04:15', title: 'Wake · water · stillness', pillar: 'mind', detail: '' },
  { start: '04:15', end: '06:15', title: 'Builder block · portfolio project', pillar: 'career', detail: 'Build in public: one GitHub project per month (K8s, platform engineering, AI agents). It proves your skills to your employer and your Fiverr buyers at the same time.' },
  bike
    ? { start: '06:15', end: '07:15', title: 'Gym · conditioning', pillar: 'body', detail: 'Cardio, mobility, core.' }
    : { start: '06:15', end: '07:15', title: 'Long walk / run', pillar: 'body', detail: 'Outdoors, no phone. Ideas arrive on long walks.' },
  { start: '07:15', end: '08:00', title: 'Shower · breakfast', pillar: 'life', detail: '' },
  { start: '08:00', end: '11:30', title: 'Content Factory II · 14 videos', pillar: 'content', detail: 'Rest of the week for A·B·C·D, then schedule all 28 in Meta Business Suite. Check last week’s analytics: double what worked.' },
  { start: '11:30', end: '12:30', title: 'Lunch · 20-min nap', pillar: 'life', detail: '' },
  { start: '12:30', end: '14:00', title: 'Fiverr analytics & optimisation', pillar: 'fiverr', detail: 'Impressions low = title/tags. Clicks low = thumbnail. Orders low = price or description. Change one thing.' },
  { start: '14:00', end: '15:00', title: 'Weekly review · Think Hour', pillar: 'mind', detail: 'Score the week, check the roadmap, set next week’s 3 big rocks. Gates takes Think Weeks; you take a Think Hour every Sunday.' },
  { start: '15:00', end: '18:00', title: 'Free · family · recharge', pillar: 'life', detail: 'Non-negotiable. Burnout costs months; rest costs hours.' },
  { start: '18:00', end: '18:30', ...PRAYER },
  { start: '18:30', end: '19:30', title: 'Dinner · family', pillar: 'life', detail: '' },
  { start: '19:30', end: '20:30', title: 'Light study · English film', pillar: 'career', detail: 'A tech talk or an English film with English subtitles. Learning that feels like rest.' },
  { start: '20:30', end: '21:30', title: 'Reading · books that compound', pillar: 'wealth', detail: 'One book a month on money, business or biography. Buffett spends most of his day reading.' },
  { start: '21:30', end: '22:00', title: 'Prep the week', pillar: 'mind', detail: 'Clothes, bag, lunch plan, Monday’s top 3. Make 04:00 Monday frictionless.' },
  { start: '22:00', end: '04:00', ...SLEEP },
]

export const PLANS = {
  A: { key: 'A', name: 'Plan A · Now', sub: 'No bike · leave 06:00 · home 18:00' },
  B: { key: 'B', name: 'Plan B · Bike', sub: 'Leave 07:30 · gym every morning' },
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Length in minutes, handling blocks that wrap midnight (sleep).
export function blockLen(b) {
  const s = toMin(b.start)
  const e = toMin(b.end)
  return e > s ? e - s : 1440 - s + e
}

export function getSchedule(plan, dayIndex) {
  const bike = plan === 'B'
  let raw
  if (dayIndex === 6) raw = saturday(bike)
  else if (dayIndex === 0) raw = sunday(bike)
  else raw = bike ? weekdayB : weekdayA

  return raw.map((b, i) => {
    let block = { ...b, id: `${dayIndex}-${i}` }
    if (b.byDay && b.byDay[dayIndex]) block = { ...block, ...b.byDay[dayIndex] }
    if (b.byDayDetail && b.byDayDetail[dayIndex]) block.detail = b.byDayDetail[dayIndex]
    delete block.byDay
    delete block.byDayDetail
    return block
  })
}

export function findCurrent(blocks, minutes) {
  const idx = blocks.findIndex((b) => {
    const s = toMin(b.start)
    const e = toMin(b.end)
    return e > s ? minutes >= s && minutes < e : minutes >= s || minutes < e
  })
  return idx
}

// Hours per pillar across a full week for a plan.
export function weeklyHours(plan) {
  const totals = {}
  for (let d = 0; d < 7; d++) {
    for (const b of getSchedule(plan, d)) {
      totals[b.pillar] = (totals[b.pillar] || 0) + blockLen(b) / 60
    }
  }
  return totals
}

// Timetable helpers that read from the content document.

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

function dayType(day) {
  return day === 6 ? 'saturday' : day === 0 ? 'sunday' : 'weekday'
}

/** Blocks for one plan and weekday (0 = Sunday), with rotations and one-off overrides applied. */
export function getSchedule(content, plan, day) {
  const sched = content.schedule
  const raw = sched.overrides?.[`${plan}-${day}`] || sched[plan]?.[dayType(day)] || []
  return raw
    .map((b, i) => {
      const rot = b.byDay?.[String(day)]
      const { byDay, ...base } = b
      return { ...base, ...(rot || {}), id: `${plan}-${day}-${i}` }
    })
    .sort((a, b) => toMin(a.start) - toMin(b.start))
}

export function findCurrent(blocks, minutes) {
  return blocks.findIndex((b) => {
    const s = toMin(b.start)
    const e = toMin(b.end)
    return e > s ? minutes >= s && minutes < e : minutes >= s || minutes < e
  })
}

export function weeklyHours(content, plan) {
  const totals = {}
  for (let d = 0; d < 7; d++) {
    for (const b of getSchedule(content, plan, d)) totals[b.pillar] = (totals[b.pillar] || 0) + blockLen(b) / 60
  }
  return totals
}

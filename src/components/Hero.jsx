import { motion } from 'framer-motion'
import { PILLARS } from '../data/pillars'
import { getSchedule, findCurrent, toMin, blockLen, DAY_NAMES, PLANS } from '../data/schedule'
import { fmtDuration } from '../hooks'

export function useCurrentBlock(plan, now) {
  const day = now.getDay()
  const blocks = getSchedule(plan, day)
  const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const idx = findCurrent(blocks, mins)
  const cur = blocks[idx]
  // Sleep wraps midnight, so before 04:00 the "next" block is in the same day's list (index 0).
  const next = blocks[(idx + 1) % blocks.length]
  const start = toMin(cur.start)
  const elapsed = (mins - start + 1440) % 1440
  const len = blockLen(cur)
  return { cur, next, progress: Math.min(1, elapsed / len), remaining: len - elapsed, day }
}

export default function Hero({ plan, setPlan, now }) {
  const { cur, next, progress, remaining, day } = useCurrentBlock(plan, now)
  const color = PILLARS[cur.pillar].color
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <header className="hero" id="top">
      <motion.div className="hero-copy" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}>
        <p className="eyebrow">Piyumal Ranasinghe · Operating System v1</p>
        <h1 className="title">
          <span className="title-grad">ASCEND</span>
        </h1>
        <p className="lede">
          04:00 → 22:00. One engineer, four fronts: <b style={{ color: PILLARS.career.color }}>career</b>,{' '}
          <b style={{ color: PILLARS.fiverr.color }}>Fiverr</b>, <b style={{ color: PILLARS.content.color }}>four channels</b> and{' '}
          <b style={{ color: PILLARS.wealth.color }}>wealth</b>. Built on the daily habits of men who made it.
        </p>

        <div className="plan-switch" role="tablist" aria-label="Plan">
          {Object.values(PLANS).map((p) => (
            <button key={p.key} role="tab" aria-selected={plan === p.key} className={plan === p.key ? 'on' : ''} onClick={() => setPlan(p.key)}>
              <span>{p.name}</span>
              <small>{p.sub}</small>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="now-card glass"
        style={{ '--c': color }}
        initial={{ opacity: 0, scale: 0.92, rotateX: 18 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
        transition={{ duration: 1.1, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="now-top">
          <span className="live-dot" /> LIVE · {DAY_NAMES[day]}
          <span className="clock mono">{time}</span>
        </div>
        <div className="now-label">Right now you should be on</div>
        <motion.h2 key={cur.id} className="now-title" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <span className="pill" style={{ background: color }}>{PILLARS[cur.pillar].icon}</span>
          {cur.title}
        </motion.h2>
        <p className="now-detail">{cur.detail}</p>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${progress * 100}%`, background: color }} />
        </div>
        <div className="now-meta mono">
          <span>{cur.start} – {cur.end}</span>
          <span>{fmtDuration(remaining)} left</span>
        </div>
        <div className="now-next">
          <span className="muted">Next</span>
          <span className="dot" style={{ background: PILLARS[next.pillar].color }} />
          <b>{next.title}</b>
          <span className="mono muted">{next.start}</span>
        </div>
      </motion.div>

      <a href="#timetable" className="scroll-cue" aria-label="Scroll to timetable">
        <span />
      </a>
    </header>
  )
}

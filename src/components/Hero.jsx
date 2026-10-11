import { motion } from 'framer-motion'
import { getSchedule, findCurrent, toMin, blockLen, DAY_NAMES } from '../lib/plan'
import { useContent, pillarOf } from '../lib/content'
import { fmtDuration } from '../hooks'

// "{career|four fronts}" → text coloured with that pillar's colour.
export function RichText({ text, content }) {
  const parts = text.split(/(\{[a-z0-9_]+\|[^}]+\})/g)
  return parts.map((part, i) => {
    const m = part.match(/^\{([a-z0-9_]+)\|([^}]+)\}$/)
    return m ? <b key={i} style={{ color: pillarOf(content, m[1]).color }}>{m[2]}</b> : part
  })
}

export function useCurrentBlock(content, plan, now) {
  const day = now.getDay()
  const blocks = getSchedule(content, plan, day)
  const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const idx = findCurrent(blocks, mins)
  let cur = blocks[idx]
  let next = blocks[(idx + 1) % blocks.length]
  if (!cur) {
    // A gap in the timetable: show it as free time until the next block starts.
    const upcoming = blocks.find((b) => toMin(b.start) > mins) || blocks[0]
    const prev = [...blocks].reverse().find((b) => toMin(b.end) <= mins && toMin(b.end) > toMin(b.start))
    cur = { id: 'gap', title: 'Free time', pillar: 'life', detail: 'Nothing planned. Rest, or get ahead on tomorrow.', start: prev?.end || '00:00', end: upcoming?.start || '23:59' }
    next = upcoming || cur
  }
  const start = toMin(cur.start)
  const elapsed = (mins - start + 1440) % 1440
  const len = blockLen(cur)
  return { cur, next, progress: Math.min(1, elapsed / len), remaining: len - elapsed, day }
}

export default function Hero({ plan, setPlan, now }) {
  const content = useContent()
  const { site, plans } = content
  const { cur, next, progress, remaining, day } = useCurrentBlock(content, plan, now)
  const color = pillarOf(content, cur.pillar).color
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <header className="hero" id="top">
      <motion.div className="hero-copy" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}>
        <p className="eyebrow">{site.eyebrow}</p>
        <h1 className="title">
          <span className="title-grad">{site.title}</span>
        </h1>
        <p className="lede"><RichText text={site.lede} content={content} /></p>

        <div className="plan-switch" role="tablist" aria-label="Plan">
          {['A', 'B'].map((k) => ({ key: k, ...plans[k] })).map((p) => (
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
          <span className="pill" style={{ background: color }}>{pillarOf(content, cur.pillar).icon}</span>
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
          <span className="dot" style={{ background: pillarOf(content, next.pillar).color }} />
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

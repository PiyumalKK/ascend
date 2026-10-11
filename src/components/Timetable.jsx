import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Section from './Section'
import { PILLARS } from '../data/pillars'
import { getSchedule, findCurrent, toMin, blockLen, weeklyHours, DAY_NAMES, PLANS } from '../data/schedule'
import { fmtDuration } from '../hooks'

const R = 150
const C = 180

function polar(min, r) {
  const a = (min / 1440) * Math.PI * 2 - Math.PI / 2
  return [C + Math.cos(a) * r, C + Math.sin(a) * r]
}

function arcPath(startMin, lenMin, r) {
  const end = startMin + lenMin
  const [x1, y1] = polar(startMin, r)
  const [x2, y2] = polar(end, r)
  const large = lenMin > 720 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

function DayDial({ blocks, focus, setFocus, nowMin, isToday }) {
  const shown = blocks.find((b) => b.id === focus) || (isToday ? blocks[findCurrent(blocks, nowMin)] : blocks[1])
  const [nx, ny] = polar(nowMin, R + 26)
  return (
    <div className="dial-wrap">
      <svg viewBox="0 0 360 360" className="dial" role="img" aria-label="24 hour day dial">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="30" />
        {Array.from({ length: 24 }).map((_, h) => {
          const [x1, y1] = polar(h * 60, R + 18)
          const [x2, y2] = polar(h * 60, R + (h % 6 === 0 ? 30 : 23))
          const [tx, ty] = polar(h * 60, R + 42)
          return (
            <g key={h}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth={h % 6 === 0 ? 2 : 1} />
              {h % 3 === 0 && (
                <text x={tx} y={ty} className="dial-num" textAnchor="middle" dominantBaseline="middle">
                  {String(h).padStart(2, '0')}
                </text>
              )}
            </g>
          )
        })}
        {blocks.map((b) => {
          const active = shown && b.id === shown.id
          return (
            <path
              key={b.id}
              d={arcPath(toMin(b.start) + 1.5, Math.max(1, blockLen(b) - 3), R)}
              fill="none"
              stroke={PILLARS[b.pillar].color}
              strokeWidth={active ? 38 : 28}
              strokeOpacity={active ? 1 : b.pillar === 'sleep' ? 0.55 : 0.8}
              filter={active ? 'url(#glow)' : undefined}
              className="dial-arc"
              onMouseEnter={() => setFocus(b.id)}
              onClick={() => setFocus(b.id)}
            >
              <title>{`${b.start}–${b.end} ${b.title}`}</title>
            </path>
          )
        })}
        {isToday && (
          <g className="needle">
            <line x1={C} y1={C} x2={nx} y2={ny} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <circle cx={nx} cy={ny} r="5" fill="#fff" filter="url(#glow)" />
          </g>
        )}
        <circle cx={C} cy={C} r="96" fill="rgba(6,8,22,0.85)" stroke="rgba(255,255,255,0.08)" />
        {shown && (
          <foreignObject x={C - 86} y={C - 70} width="172" height="140">
            <div className="dial-center">
              <span className="dial-time mono">{shown.start} – {shown.end}</span>
              <b style={{ color: PILLARS[shown.pillar].color }}>{shown.title}</b>
              <span className="dial-len">{fmtDuration(blockLen(shown))}</span>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  )
}

function WeeklyHours({ plan }) {
  const totals = weeklyHours(plan)
  const keys = ['fiverr', 'career', 'content', 'wealth', 'body', 'mind', 'life', 'office', 'commute', 'sleep']
  const max = Math.max(...keys.map((k) => totals[k] || 0))
  return (
    <div className="hours glass">
      <div className="hours-head">
        <h3>Your week in hours</h3>
        <span className="muted">{PLANS[plan].name}</span>
      </div>
      {keys.map((k, i) => (
        <div className="hours-row" key={k}>
          <span className="hours-label">{PILLARS[k].label}</span>
          <div className="hours-track">
            <motion.div
              className="hours-fill"
              style={{ background: PILLARS[k].color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${((totals[k] || 0) / max) * 100}%` }}
              viewport={{ once: false }}
              transition={{ duration: 0.9, delay: i * 0.04 }}
            />
          </div>
          <span className="hours-val mono">{(totals[k] || 0).toFixed(1)}h</span>
        </div>
      ))}
      <p className="hours-note">
        Fiverr + career + content + wealth ={' '}
        <b>{['fiverr', 'career', 'content', 'wealth'].reduce((s, k) => s + (totals[k] || 0), 0).toFixed(1)} hours</b> of
        deliberate growth every week, on top of a full-time job.
      </p>
    </div>
  )
}

export default function Timetable({ plan, setPlan, now }) {
  const today = now.getDay()
  const [day, setDay] = useState(today)
  const [focus, setFocus] = useState(null)
  const [open, setOpen] = useState(null)
  const blocks = getSchedule(plan, day)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isToday = day === today
  const curIdx = isToday ? findCurrent(blocks, nowMin) : -1
  const order = [1, 2, 3, 4, 5, 6, 0]

  return (
    <Section
      id="timetable"
      kicker="01 · The timetable"
      title="Every hour has a job"
      intro="Two protected deep-work blocks a day, the hardest work first, content batched on weekends, and recovery scheduled like a meeting. Tap any block on the dial or the list."
    >
      <div className="tt-controls">
        <div className="days" role="tablist" aria-label="Day">
          {order.map((d) => (
            <button key={d} role="tab" aria-selected={day === d} className={`${day === d ? 'on' : ''} ${d === today ? 'today' : ''}`} onClick={() => { setDay(d); setFocus(null); setOpen(null) }}>
              {DAY_NAMES[d].slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="plan-mini">
          {Object.values(PLANS).map((p) => (
            <button key={p.key} className={plan === p.key ? 'on' : ''} onClick={() => setPlan(p.key)}>
              {p.key === 'A' ? 'No bike' : 'Bike + gym'}
            </button>
          ))}
        </div>
      </div>

      <div className="tt-grid">
        <div className="tt-left">
          <DayDial blocks={blocks} focus={focus} setFocus={setFocus} nowMin={nowMin} isToday={isToday} />
          <div className="legend">
            {Object.values(PILLARS).map((p) => (
              <span key={p.key}><i style={{ background: p.color }} />{p.label}</span>
            ))}
          </div>
        </div>

        <ol className="timeline">
          {blocks.map((b, i) => {
            const c = PILLARS[b.pillar].color
            const isOpen = open === b.id
            return (
              <motion.li
                key={`${plan}-${b.id}`}
                className={`tl-item ${i === curIdx ? 'current' : ''} ${isOpen ? 'open' : ''}`}
                style={{ '--c': c }}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                onMouseEnter={() => setFocus(b.id)}
              >
                <button className="tl-btn" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen}>
                  <span className="tl-time mono">{b.start}</span>
                  <span className="tl-bar" />
                  <span className="tl-title">{b.title}</span>
                  <span className="tl-len mono">{fmtDuration(blockLen(b))}</span>
                  {i === curIdx && <span className="tl-now">NOW</span>}
                </button>
                <AnimatePresence>
                  {isOpen && b.detail && (
                    <motion.p className="tl-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      {b.detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </ol>
      </div>

      <WeeklyHours plan={plan} />

      <div className="callout glass">
        <b>About the 6 hours of sleep.</b> Your 22:00 → 04:00 window is the same one Franklin used, but research says most
        adults do best on 7+. That is why the plan includes a weekend nap, Sunday rest, and a lights-out rule that never moves.
        If your energy drops for a week straight, move the alarm to 04:30 before you give up anything else.
      </div>
    </Section>
  )
}

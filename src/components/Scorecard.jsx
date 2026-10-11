import { motion } from 'framer-motion'
import Section from './Section'
import { PILLARS } from '../data/pillars'
import { SCORECARD } from '../data/growth'
import { dateKey } from '../hooks'
import { useScorecardLog } from '../lib/store'
import { ViewOnlyNote } from './Account'

const TOTAL = SCORECARD.length

export default function Scorecard({ now }) {
  const { log, toggle: toggleItem, canEdit } = useScorecardLog(35)
  const todayKey = dateKey(now)
  const today = log[todayKey] || {}
  const score = SCORECARD.filter((s) => today[s.id]).length

  const toggle = (id) => toggleItem(todayKey, id)

  // Last 35 days, oldest first, for the heatmap.
  const days = Array.from({ length: 35 }).map((_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (34 - i))
    const k = dateKey(d)
    const n = SCORECARD.filter((s) => log[k]?.[s.id]).length
    return { k, n, d }
  })

  // A day counts toward the streak at 7 of 9 or better. Today does not break it until it is over.
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].n >= 7) streak++
    else if (i === days.length - 1) continue
    else break
  }

  return (
    <Section id="scorecard" kicker="05 · Daily scorecard" title="Win the day, nine times" intro="Tick these during your shutdown ritual. Seven out of nine counts as a won day. Synced across your devices.">
      <div className="score-grid">
        <div className="glass card">
          <div className="score-head">
            <div>
              <span className="muted small">{now.toDateString()}</span>
              <div className="score-big"><b>{score}</b>/{TOTAL}</div>
            </div>
            <div className="streak">
              <span className="flame">🔥</span>
              <b>{streak}</b>
              <small>day streak</small>
            </div>
          </div>
          <ViewOnlyNote />
          <ul className="score-list">
            {SCORECARD.map((s) => (
              <li key={s.id}>
                <label className={today[s.id] ? 'done' : ''} style={{ '--c': PILLARS[s.pillar].color }}>
                  <input type="checkbox" disabled={!canEdit} checked={!!today[s.id]} onChange={() => toggle(s.id)} />
                  <span className="check" />
                  {s.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass card">
          <h3>Last 5 weeks</h3>
          <div className="heat">
            {days.map((d, i) => (
              <motion.span
                key={d.k}
                className={`heat-cell ${d.k === todayKey ? 'is-today' : ''}`}
                title={`${d.k}: ${d.n}/${TOTAL}`}
                style={{ '--a': d.n / TOTAL }}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.012 }}
              />
            ))}
          </div>
          <p className="small muted">Every square is a day. Brighter means more boxes ticked. Do not break the chain.</p>
          <blockquote className="big-quote">
            “We are what we repeatedly do. Excellence, then, is not an act, but a habit.”
            <cite>Will Durant, summarising Aristotle</cite>
          </blockquote>
        </div>
      </div>
    </Section>
  )
}

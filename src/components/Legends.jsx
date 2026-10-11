import { useState } from 'react'
import { motion } from 'framer-motion'
import Section, { rise } from './Section'
import { LEGENDS, PRINCIPLES } from '../data/legends'

function initials(name) {
  return name.split(/\s|&/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('')
}

function FlipCard({ l, i }) {
  const [flipped, setFlipped] = useState(false)
  const hue = (i * 33 + 190) % 360
  return (
    <motion.div variants={rise} initial="hidden" whileInView="show" custom={i % 4} viewport={{ once: true, margin: '-40px' }}>
      <button className={`flip ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-pressed={flipped} style={{ '--h': hue }}>
        <div className="flip-inner">
          <div className="flip-face front-face">
            <span className="avatar">{initials(l.name)}</span>
            <b className="legend-name">{l.name}</b>
            <span className="legend-role">{l.role}</span>
            {l.wake !== '—' && <span className="legend-wake mono">wakes {l.wake}</span>}
            <div className="flip-foot">
              {l.quote && <q>{l.quote}</q>}
              <span className="flip-hint">tap to see the habit ↻</span>
            </div>
          </div>
          <div className="flip-face back-face">
            <span className="back-k">The habit</span>
            <p>{l.habit}</p>
            <span className="back-k">In your plan</span>
            <p className="yours">{l.yours}</p>
          </div>
        </div>
      </button>
    </motion.div>
  )
}

export default function Legends() {
  return (
    <Section
      id="legends"
      kicker="03 · Research"
      title="How successful men built their days"
      intro="Eleven lives, one pattern: early starts, the hard work first, deep focus, constant reading and protected recovery. Each card shows the habit and where it lives in your timetable."
    >
      <div className="legends">
        {LEGENDS.map((l, i) => <FlipCard key={l.name} l={l} i={i} />)}
      </div>
      <div className="principles">
        {PRINCIPLES.map((p, i) => (
          <motion.div key={p.k} className="principle glass" variants={rise} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}>
            <span className="mono">{String(i + 1).padStart(2, '0')}</span>
            <b>{p.k}</b>
            <p>{p.v}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}

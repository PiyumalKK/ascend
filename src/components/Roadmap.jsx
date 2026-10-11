import { motion } from 'framer-motion'
import Section from './Section'
import { ROADMAP } from '../data/growth'

export default function Roadmap() {
  return (
    <Section id="roadmap" kicker="04 · Twelve months" title="The road to October 2027" intro="Targets, not promises. Check them in your Sunday Think Hour and adjust the next quarter, never the vision.">
      <div className="road">
        <div className="road-line" />
        {ROADMAP.map((r, i) => (
          <motion.div
            key={r.when}
            className={`stop ${i % 2 ? 'right' : 'left'}`}
            initial={{ opacity: 0, x: i % 2 ? 60 : -60, rotateY: i % 2 ? -25 : 25 }}
            whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="stop-node" />
            <div className="stop-card glass">
              <span className="stop-when mono">{r.when}</span>
              <ul>
                {r.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}

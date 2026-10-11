import { motion } from 'framer-motion'
import Section from './Section'
import { useContent } from '../lib/content'

export default function Roadmap() {
  const content = useContent()
  const text = content.site.sections.roadmap
  return (
    <Section id="roadmap" kicker={text.kicker} title={text.title} intro={text.intro}>
      <div className="road">
        <div className="road-line" />
        {content.roadmap.map((r, i) => (
          <motion.div
            key={`${r.when}-${i}`}
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

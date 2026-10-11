import { motion } from 'framer-motion'

export const rise = {
  hidden: { opacity: 0, y: 40 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] } }),
}

export default function Section({ id, kicker, title, intro, color, children }) {
  return (
    <section id={id} className="section" style={color ? { '--c': color } : undefined}>
      <motion.div className="section-head" variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
        <p className="kicker">{kicker}</p>
        <h2 className="section-title">{title}</h2>
        {intro && <p className="section-intro">{intro}</p>}
      </motion.div>
      {children}
    </section>
  )
}

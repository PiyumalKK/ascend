import { lazy, Suspense, useEffect, useState } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import Hero, { useCurrentBlock } from './components/Hero'
import Timetable from './components/Timetable'
import Fronts from './components/Fronts'
import Legends from './components/Legends'
import Roadmap from './components/Roadmap'
import Scorecard from './components/Scorecard'
import { PILLARS } from './data/pillars'
import { useNow } from './hooks'
import { useCloudState } from './lib/store'
import Account from './components/Account'
import InstallButton from './components/InstallButton'

const Scene3D = lazy(() => import('./components/Scene3D'))

const LINKS = [
  ['timetable', 'Timetable'],
  ['fronts', 'Fronts'],
  ['legends', 'Legends'],
  ['roadmap', 'Roadmap'],
  ['scorecard', 'Scorecard'],
]

function Nav({ now, color }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <nav className={`nav ${scrolled ? 'solid' : ''}`}>
      <a href="#top" className="brand">
        <span className="brand-mark" style={{ background: color }} />
        ASCEND
      </a>
      <div className="nav-links">
        {LINKS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </div>
      <InstallButton />
      <Account />
      <span className="nav-clock mono">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
    </nav>
  )
}

export default function App() {
  const now = useNow(1000)
  const [plan, setPlan] = useCloudState('plan', 'A')
  const [startKey, setStartKey] = useCloudState('start', '2026-10-12', { viewOnly: true })
  const { cur } = useCurrentBlock(plan, now)
  const accent = PILLARS[cur.pillar].color
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <>
      <motion.div className="progress" style={{ scaleX: progress, background: accent }} />
      <Suspense fallback={<div className="scene scene-fallback" />}>
        <Scene3D accent={accent} />
      </Suspense>
      <div className="vignette" />
      <Nav now={now} color={accent} />
      <main>
        <Hero plan={plan} setPlan={setPlan} now={now} />
        <Timetable plan={plan} setPlan={setPlan} now={now} />
        <Fronts startKey={startKey} setStartKey={setStartKey} now={now} />
        <Legends />
        <Roadmap />
        <Scorecard now={now} />
      </main>
      <footer className="footer">
        <p className="footer-quote">“Discipline equals freedom.”</p>
        <p className="muted small">Built for Piyumal Ranasinghe · DevOps Engineer · Colombo · 04:00 → 22:00</p>
      </footer>
    </>
  )
}

import { lazy, Suspense, useEffect, useState } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import Hero, { useCurrentBlock } from './components/Hero'
import Timetable from './components/Timetable'
import Fronts from './components/Fronts'
import Legends from './components/Legends'
import Roadmap from './components/Roadmap'
import Scorecard from './components/Scorecard'
import Alerts from './components/Alerts'
import { useContent, pillarOf } from './lib/content'
import { useNow } from './hooks'
import { useCloudState } from './lib/store'
import Account from './components/Account'
import InstallButton from './components/InstallButton'
import Assistant from './components/Assistant'

const Scene3D = lazy(() => import('./components/Scene3D'))

const LINKS = [
  ['timetable', 'Timetable'],
  ['fronts', 'Fronts'],
  ['legends', 'Legends'],
  ['roadmap', 'Roadmap'],
  ['scorecard', 'Scorecard'],
  ['alerts', 'App'],
]

function Nav({ now, color, brand }) {
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
        {brand}
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
  const content = useContent()
  const { cur } = useCurrentBlock(content, plan, now)
  const accent = pillarOf(content, cur.pillar).color
  const planets = content.coreFour.map((k) => pillarOf(content, k).color)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <>
      <motion.div className="progress" style={{ scaleX: progress, background: accent }} />
      <Suspense fallback={<div className="scene scene-fallback" />}>
        <Scene3D accent={accent} planets={planets} />
      </Suspense>
      <div className="vignette" />
      <Nav now={now} color={accent} brand={content.site.brand} />
      <main>
        <Hero plan={plan} setPlan={setPlan} now={now} />
        <Timetable plan={plan} setPlan={setPlan} now={now} />
        <Fronts startKey={startKey} setStartKey={setStartKey} now={now} />
        <Legends />
        <Roadmap />
        <Scorecard now={now} />
        <Alerts plan={plan} />
      </main>
      <footer className="footer">
        <p className="footer-quote">{content.site.footerQuote}</p>
        <p className="muted small">{content.site.footerNote}</p>
      </footer>
      <Assistant />
    </>
  )
}

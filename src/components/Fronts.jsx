import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Section, { rise } from './Section'
import TiltCard from './TiltCard'
import { daysBetween } from '../hooks'
import { useCloudState } from '../lib/store'
import { useContent, pillarOf } from '../lib/content'
import { ViewOnlyNote } from './Account'

function Ring({ value, color, size = 84 }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 84 84" className="ring">
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <motion.circle
        cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }}
        transition={{ duration: 1 }} transform="rotate(-90 42 42)"
      />
      <text x="42" y="46" textAnchor="middle" className="ring-text">{Math.round(value * 100)}%</text>
    </svg>
  )
}

function Career() {
  const ct = useContent()
  return (
    <div className="panel-grid">
      <div className="glass card">
        <h3>Certification ladder</h3>
        <ol className="ladder">
          {ct.certs.map((c) => (
            <li key={c.name} className={`rung ${c.status}`}>
              <span className="rung-dot" />
              <div>
                <b>{c.name}</b>
                <span className="mono muted"> · {c.when}</span>
                <p>{c.why}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="stack">
        <div className="glass card">
          <h3>Spoken English system</h3>
          <ul className="ticks">
            {ct.english.map((e) => (
              <li key={e.t}><b>{e.t}.</b> {e.d}</li>
            ))}
          </ul>
        </div>
        <div className="glass card">
          <h3>Domain knowledge, next 12 months</h3>
          <ul className="chips">
            {ct.domain.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Fiverr({ startKey, setStartKey, now }) {
  const [done, setDone, canEdit] = useCloudState('fiverr.done', {}, { viewOnly: true })
  const ct = useContent()
  const dayN = daysBetween(startKey, now) + 1
  const progress = ct.launch.length ? ct.launch.filter((t) => done[t.id]).length / ct.launch.length : 0
  const color = pillarOf(ct, 'fiverr').color
  return (
    <div className="panel-grid">
      <div className="glass card">
        <div className="card-head">
          <div>
            <h3>30-day launch → Level 1</h3>
            <label className="date-pick">
              Day 1 =
              <input type="date" disabled={!canEdit} value={startKey} onChange={(e) => e.target.value && setStartKey(e.target.value)} />
            </label>
            <p className="muted small">
              {dayN < 1 ? `Starts in ${1 - dayN} day${dayN === 0 ? '' : 's'}` : `You are on day ${dayN}`}
            </p>
          </div>
          <Ring value={progress} color={color} />
        </div>
        <ViewOnlyNote />
        <ol className="launch">
          {ct.launch.map((t) => {
            const state = done[t.id] ? 'done' : dayN >= t.day && dayN <= t.end ? 'active' : dayN > t.end ? 'late' : ''
            return (
              <li key={t.id} className={`launch-item ${state}`}>
                <label>
                  <input type="checkbox" disabled={!canEdit} checked={!!done[t.id]} onChange={() => setDone({ ...done, [t.id]: !done[t.id] })} />
                  <span className="check" />
                  <span className="mono day">D{t.day}{t.end !== t.day ? `–${t.end}` : ''}</span>
                  <span className="launch-text">
                    <b>{t.title}</b>
                    <small>{t.detail}</small>
                  </span>
                </label>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="stack">
        <div className="glass card">
          <h3>The gigs, in publish order</h3>
          <div className="gigs">
            {ct.gigs.map((g) => (
              <div key={g.id} className={`gig ${g.n > 7 ? 'locked' : ''}`}>
                <span className="gig-n mono">#{g.n}</span>
                <div>
                  <b>{g.name}</b>
                  <small>{g.note}</small>
                </div>
                <span className="gig-price mono">{g.price}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass card">
          <h3>Rules that rank you</h3>
          <ul className="ticks">{ct.fiverrRules.map((r) => <li key={r}>{r}</li>)}</ul>
          <div className="levels">
            {ct.levels.map((l) => (
              <div key={l.name} className="level">
                <b>{l.name}</b>
                <small>{l.req}</small>
                <span>{l.unlock}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Content() {
  const [names, setNames, canEdit] = useCloudState('channels', { A: '', B: '', C: '', D: '' }, { viewOnly: true })
  const ct = useContent()
  const color = pillarOf(ct, 'content').color
  const perDay = ct.channels.videosPerChannelPerDay
  return (
    <div className="panel-grid">
      <div className="stack">
        <div className="glass card">
          <h3>Your four channels</h3>
          <p className="muted small">Name them. Synced to your account.</p>
          <ViewOnlyNote />
          <div className="channels">
            {['A', 'B', 'C', 'D'].map((k, i) => (
              <TiltCard key={k} className="channel" style={{ '--c': color }}>
                <span className="channel-k">{k}</span>
                <input
                  readOnly={!canEdit}
                  value={names[k]}
                  placeholder={ct.channels.suggestions[i] || ''}
                  onChange={(e) => setNames({ ...names, [k]: e.target.value })}
                  aria-label={`Channel ${k} name`}
                />
                <span className="channel-q mono">{7 * perDay} videos / week</span>
              </TiltCard>
            ))}
          </div>
        </div>
        <div className="glass card">
          <h3>The weekly math</h3>
          <div className="math">
            <div><b>4 × {perDay}</b><small>channels × per day</small></div>
            <span>×</span>
            <div><b>7</b><small>days</small></div>
            <span>=</span>
            <div><b style={{ color }}>{28 * perDay}</b><small>videos / week</small></div>
          </div>
          <p className="small">{ct.channels.batchNote}</p>
        </div>
      </div>
      <div className="stack">
        <div className="glass card">
          <h3>AI production pipeline</h3>
          <ol className="pipeline">
            {ct.contentPipeline.map((p, i) => (
              <motion.li key={p.step} variants={rise} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}>
                <span className="pipe-n mono">{String(i + 1).padStart(2, '0')}</span>
                <b>{p.step}</b>
                <small>{p.tool}</small>
                <span className="pipe-time mono">{p.time}</span>
              </motion.li>
            ))}
          </ol>
        </div>
        <div className="glass card warn">
          <h3>Monetization reality check</h3>
          <ul className="ticks">{ct.contentRules.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      </div>
    </div>
  )
}

function Wealth({ startKey, now }) {
  const ct = useContent()
  const total = ct.wealthWeeks.length
  const week = Math.min(total, Math.max(1, Math.floor(daysBetween(startKey, now) / 7) + 1))
  return (
    <div className="panel-grid">
      <div className="glass card">
        <h3>{total}-week research curriculum</h3>
        <p className="muted small">25 minutes every weeknight, plus a 1-hour Saturday deep dive. You are in week {week}.</p>
        <div className="weeks">
          {ct.wealthWeeks.map((w) => (
            <div key={w.w} className={`week ${w.w === week ? 'now' : w.w < week ? 'past' : ''}`}>
              <span className="mono">W{w.w}</span>
              <b>{w.t}</b>
              <small>{w.d}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="glass card warn">
        <h3>Guardrails, non-negotiable</h3>
        <ul className="ticks">{ct.wealthGuardrails.map((g) => <li key={g}>{g}</li>)}</ul>
      </div>
    </div>
  )
}

export default function Fronts({ startKey, setStartKey, now }) {
  const ct = useContent()
  const [picked, setTab] = useState('fiverr')
  const tab = ct.coreFour.includes(picked) ? picked : ct.coreFour[0]
  const text = ct.site.sections.fronts
  return (
    <Section id="fronts" kicker={text.kicker} title={text.title} intro={text.intro}>
      <div className="front-tabs">
        {ct.coreFour.map((k, i) => {
          const p = pillarOf(ct, k)
          const f = ct.fronts[k] || { headline: p.label, stat: '', blurb: '' }
          return (
            <motion.div key={k} variants={rise} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}>
              <TiltCard className={`front ${tab === k ? 'on' : ''}`} style={{ '--c': p.color }} onClick={() => setTab(k)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setTab(k)}>
                <span className="front-icon">{p.icon}</span>
                <span className="front-label">{p.label}</span>
                <b className="front-head">{f.headline}</b>
                <span className="front-stat mono">{f.stat}</span>
                <small>{f.blurb}</small>
              </TiltCard>
            </motion.div>
          )
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} className="front-panel" style={{ '--c': pillarOf(ct, tab).color }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
          {tab === 'career' && <Career />}
          {tab === 'fiverr' && <Fiverr startKey={startKey} setStartKey={setStartKey} now={now} />}
          {tab === 'content' && <Content />}
          {tab === 'wealth' && <Wealth startKey={startKey} now={now} />}
          {!['career', 'fiverr', 'content', 'wealth'].includes(tab) && (
            <div className="glass card"><p className="muted">This goal has no detail panel yet. Ask me to build one.</p></div>
          )}
        </motion.div>
      </AnimatePresence>
    </Section>
  )
}

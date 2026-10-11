import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Section, { rise } from './Section'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const AREA_ICON = { career: '◆', fiverr: '▲', content: '●', wealth: '■', health: '✚', habits: '✦' }

/** Ask the assistant from anywhere on the page: opens the panel and sends the text. */
export function askAssistant(text) {
  window.dispatchEvent(new CustomEvent('ascend:ask', { detail: text }))
}

export function SuggestionList({ suggestions, onDo }) {
  return (
    <ul className="sugg-list">
      {suggestions.map((s, i) => (
        <li key={i} className="sugg">
          <span className="sugg-icon" aria-hidden="true">{AREA_ICON[s.area] || '★'}</span>
          <div>
            <b>{s.title}</b>
            <p>{s.why}</p>
          </div>
          {s.action && <button className="btn ghost sm" onClick={() => onDo(s.action)}>Do it</button>}
        </li>
      ))}
    </ul>
  )
}

export function NewsList({ items, sources }) {
  return (
    <>
      <ul className="news-list">
        {items.map((n, i) => (
          <li key={i}>
            <div className="news-top">
              {n.topic && <span className="news-topic">{n.topic}</span>}
              {n.date && <span className="mono muted small">{n.date}</span>}
            </div>
            {n.url ? <a href={n.url} target="_blank" rel="noreferrer"><b>{n.headline}</b></a> : <b>{n.headline}</b>}
            <p>{n.why}</p>
            {n.action && <p className="news-action">→ {n.action}</p>}
          </li>
        ))}
      </ul>
      {sources?.length > 0 && (
        <details className="sources">
          <summary>Sources ({sources.length})</summary>
          <ul>{sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
        </details>
      )}
    </>
  )
}

function useLatestReport(kind) {
  const { isOwner, user } = useAuth()
  const [report, setReport] = useState(null)
  const load = useCallback(async () => {
    if (!isOwner) return
    const { data } = await supabase.from('ai_reports').select('id, content, meta, created_at').eq('kind', kind).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setReport(data)
  }, [isOwner, kind])
  useEffect(() => {
    load()
    if (!isOwner) return
    const ch = supabase
      .channel(`ai_reports:${kind}:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_reports', filter: `user_id=eq.${user.id}` }, (p) => p.new?.kind === kind && setReport(p.new))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load, isOwner, user, kind])
  return report
}

async function runAction(action) {
  const { data, error } = await supabase.functions.invoke('assistant', { body: { action } })
  if (error) {
    let msg = error.message
    try { msg = (await error.context.json()).error || msg } catch { /* keep */ }
    throw new Error(msg)
  }
  return data
}

function Panel({ title, kind, button, empty, render }) {
  const report = useLatestReport(kind)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function refresh() {
    setBusy(true)
    setError('')
    try {
      await runAction(kind)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="glass card growth-panel">
      <div className="growth-head">
        <div>
          <h3>{title}</h3>
          {report && <span className="muted small">Updated {new Date(report.created_at).toLocaleString()}</span>}
        </div>
        <button className="btn primary sm" onClick={refresh} disabled={busy}>{busy ? 'Working… ~20s' : button}</button>
      </div>
      {error && <p className="form-error small">{error}</p>}
      {report ? render(report) : <p className="muted small">{empty}</p>}
    </div>
  )
}

export default function Growth() {
  const { isOwner, enabled } = useAuth()
  return (
    <Section
      id="growth"
      kicker="07 · Growth radar"
      title="Your AI strategist"
      intro="An honest read on everything you track, the next best moves, and the news that matters for your career. Refresh anytime, or ask the assistant."
    >
      {!isOwner ? (
        <div className="glass card locked">
          <span className="lock-big" aria-hidden="true">🔒</span>
          <p><b>Private.</b> {enabled ? 'The strategist reads personal data, so only the owner can open it.' : 'Needs the cloud connection.'}</p>
        </div>
      ) : (
        <div className="panel-grid">
          <motion.div variants={rise} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Panel
              title="Analysis & next moves"
              kind="insights"
              button="Analyse now"
              empty="No analysis yet. Tap “Analyse now”: it reads your timetable, scorecard, Fiverr launch, money and goals."
              render={(r) => (
                <>
                  <p className="growth-summary">{r.content}</p>
                  {r.meta?.highlights?.length > 0 && <ul className="ticks">{r.meta.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
                  {r.meta?.suggestions?.length > 0 && <SuggestionList suggestions={r.meta.suggestions} onDo={askAssistant} />}
                </>
              )}
            />
          </motion.div>
          <motion.div variants={rise} initial="hidden" whileInView="show" custom={1} viewport={{ once: true }}>
            <Panel
              title="News for you"
              kind="news"
              button="Get latest news"
              empty="No news yet. Tap “Get latest news”: it searches the web for what changed in your field this month."
              render={(r) => <NewsList items={r.meta?.items || []} sources={r.meta?.sources} />}
            />
          </motion.div>
        </div>
      )}
    </Section>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useContentStore, pillarOf } from '../lib/content'
import { useStored } from '../hooks'
import VoiceButton from './VoiceButton'
import { insertTransactions, formatMoney } from '../lib/money'
import { SuggestionList, NewsList } from './Growth'
import { SECTIONS, SECTION_IDS, getAt, setAt, validateContent, validateSection, diffValues } from '../../supabase/functions/_shared/content-schema.js'

const SUGGESTIONS = [
  'Analyse my progress and tell me what to focus on this week',
  'Any news for my career this month?',
  'Spent 1200 rupees on lunch today',
  'How much did I spend on food this month?',
  'What does my Tuesday look like in Plan A?',
  'In Plan B, move the gym to 18:00 on weekdays and adjust the evening',
  'Add “Pass CKA exam” to the Q2 2027 roadmap',
  'Rename channel suggestion C to “Sri Lanka travel stories”',
]

// ---------------------------------------------------------------- diff views
function short(v) {
  if (v === undefined) return '—'
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 140 ? `${s.slice(0, 140)}…` : s
}

function DayDiff({ before = [], after = [], content }) {
  const key = (b) => `${b.start}|${b.end}|${b.title}|${b.pillar}|${b.detail}|${JSON.stringify(b.byDay || {})}`
  const beforeKeys = new Set(before.map(key))
  const afterKeys = new Set(after.map(key))
  const rows = [
    ...after.map((b) => ({ b, kind: beforeKeys.has(key(b)) ? 'same' : 'add' })),
    ...before.filter((b) => !afterKeys.has(key(b))).map((b) => ({ b, kind: 'del' })),
  ].sort((x, y) => x.b.start.localeCompare(y.b.start) || (x.kind === 'del' ? -1 : 1))
  return (
    <ul className="daydiff">
      {rows.map(({ b, kind }, i) => (
        <li key={i} className={kind}>
          <span className="mark">{kind === 'add' ? '+' : kind === 'del' ? '−' : ''}</span>
          <span className="mono">{b.start}–{b.end}</span>
          <i style={{ background: pillarOf(content, b.pillar).color }} />
          <span className="t">{b.title}</span>
        </li>
      ))}
    </ul>
  )
}

function ChangeView({ change, content }) {
  const isDay = change.section.startsWith('schedule.') && change.section !== 'schedule.overrides'
  const leaves = useMemo(() => (isDay ? [] : diffValues(change.before, change.after).slice(0, 40)), [change, isDay])
  return (
    <div className="change">
      <div className="change-head">
        <b>{change.label}</b>
        <span className="mono muted">{change.section}</span>
      </div>
      {isDay ? (
        <DayDiff before={change.before} after={change.after} content={content} />
      ) : (
        <ul className="leafdiff">
          {leaves.map((d) => (
            <li key={d.path}>
              <span className="mono path">{d.path || '(whole section)'}</span>
              {d.before !== undefined && <span className="del">{short(d.before)}</span>}
              {d.after !== undefined && <span className="add">{short(d.after)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TxProposal({ m, content, onAdd, onDiscard }) {
  const meta = Object.fromEntries([...content.finance.categories, ...content.finance.incomeCategories].map((c) => [c.key, c]))
  return (
    <div className="proposal">
      <div className="change">
        <div className="change-head"><b>Money to log</b><span className="mono muted">{m.txs.length} entr{m.txs.length === 1 ? 'y' : 'ies'}</span></div>
        <ul className="tx-list compact">
          {m.txs.map((t, i) => {
            const c = meta[t.category] || { label: t.category, icon: '•' }
            return (
              <li key={i}>
                <span className="tx-icon" aria-hidden="true">{c.icon}</span>
                <div className="tx-main"><b>{t.note || c.label}</b><small className="muted">{c.label} · {t.date}</small></div>
                <span className={`tx-amt mono ${t.kind}`}>{t.kind === 'income' ? '+' : '−'}{formatMoney(t.amount, t.currency)}</span>
              </li>
            )
          })}
        </ul>
      </div>
      {m.txError && <p className="form-error">{m.txError}</p>}
      <div className="proposal-actions">
        {m.txState === 'proposed' && (
          <>
            <button className="btn primary" onClick={onAdd}>Add {m.txs.length === 1 ? 'it' : `all ${m.txs.length}`}</button>
            <button className="btn ghost" onClick={onDiscard}>Discard</button>
          </>
        )}
        {m.txState === 'adding' && <span className="muted small">Saving…</span>}
        {m.txState === 'added' && <span className="ok-tag">✓ Added to Money</span>}
        {m.txState === 'discarded' && <span className="muted small">Discarded</span>}
      </div>
    </div>
  )
}

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'

function speak(text) {
  if (!canSpeak) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-GB'
  u.rate = 1
  const voice = window.speechSynthesis.getVoices().find((v) => /en[-_](GB|US)/i.test(v.lang))
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
}

// ---------------------------------------------------------------- chat
// The plan the user is looking at (synced setting, cached locally per user).
function currentPlan() {
  try {
    const key = Object.keys(localStorage).find((k) => /^ascend\..+\.plan$/.test(k))
    return key ? JSON.parse(localStorage.getItem(key)) : 'A'
  } catch {
    return 'A'
  }
}

async function callAssistant(message, history, onAuthError) {
  const { data, error } = await supabase.functions.invoke('assistant', { body: { message, history, plan: currentPlan() } })
  if (error) {
    let msg = error.message
    try {
      const body = await error.context.json()
      if (body?.error) msg = body.error
    } catch {
      /* keep generic message */
    }
    if (error.context?.status === 401) onAuthError?.()
    throw new Error(msg)
  }
  return data
}

function Chat({ pending, onPendingDone }) {
  const store = useContentStore()
  const { revalidate, user } = useAuth()
  const [fromVoice, setFromVoice] = useState(false)
  const [messages, setMessages] = useStored('ascend.chat.v1', [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  // A request sent from elsewhere on the page (e.g. a suggestion's "Do it").
  useEffect(() => {
    if (pending?.text && !busy) {
      send(pending.text)
      onPendingDone?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const update = (id, patch) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  async function send(text) {
    const message = text.trim()
    if (!message || busy) return
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }))
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: message }
    setMessages((ms) => [...ms, userMsg].slice(-40))
    setInput('')
    setBusy(true)
    setFromVoice(false)
    try {
      const res = await callAssistant(message, history, revalidate)
      setMessages((ms) => [...ms, {
        id: crypto.randomUUID(),
        role: 'assistant',
        txs: res.transactions?.length ? res.transactions : undefined,
        highlights: res.highlights?.length ? res.highlights : undefined,
        suggestions: res.suggestions?.length ? res.suggestions : undefined,
        news: res.news?.length ? res.news : undefined,
        sources: res.sources?.length ? res.sources : undefined,
        txState: res.transactions?.length ? 'proposed' : undefined,
        voice: fromVoice,
        content: res.reply,
        summary: res.summary,
        changes: res.changes?.length ? res.changes : undefined,
        state: res.changes?.length ? 'proposed' : undefined,
        provider: res.provider,
      }].slice(-40))
    } catch (e) {
      setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: 'assistant', content: `⚠️ ${e.message}`, error: true }])
    } finally {
      setBusy(false)
    }
  }

  async function apply(m) {
    update(m.id, { state: 'applying' })
    try {
      let next = store.content
      for (const c of m.changes) next = setAt(next, c.section, c.after)
      const errors = validateContent(next)
      if (errors.length) throw new Error(errors.slice(0, 3).join('; '))
      const previous = store.version
      const id = await store.save(next, m.summary || m.content, 'ai')
      update(m.id, { state: 'applied', versionId: id, previousVersion: previous })
    } catch (e) {
      update(m.id, { state: 'proposed', applyError: e.message })
    }
  }

  async function addTxs(m) {
    update(m.id, { txState: 'adding', txError: '' })
    try {
      await insertTransactions(user.id, m.txs.map((t) => ({
        kind: t.kind, amount: t.amount, currency: t.currency, category: t.category,
        note: t.note || null, occurred_on: t.date, source: m.voice ? 'voice' : 'ai',
      })))
      update(m.id, { txState: 'added' })
    } catch (e) {
      update(m.id, { txState: 'proposed', txError: e.message })
    }
  }

  async function undo(m) {
    update(m.id, { state: 'undoing' })
    try {
      await store.restore(m.previousVersion)
      update(m.id, { state: 'undone' })
    } catch (e) {
      update(m.id, { state: 'applied', applyError: e.message })
    }
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Ask me to change anything on your site, or ask about your plan. You always see a preview before anything is saved.</p>
            <div className="chips-row">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role} ${m.error ? 'error' : ''}`}>
            <p>{m.content}</p>
            {m.changes && (
              <div className="proposal">
                {m.changes.map((c) => <ChangeView key={c.section} change={c} content={store.content} />)}
                {m.applyError && <p className="form-error">{m.applyError}</p>}
                <div className="proposal-actions">
                  {m.state === 'proposed' && (
                    <>
                      <button className="btn primary" onClick={() => apply(m)}>Apply</button>
                      <button className="btn ghost" onClick={() => update(m.id, { state: 'discarded' })}>Discard</button>
                    </>
                  )}
                  {m.state === 'applying' && <span className="muted small">Saving…</span>}
                  {m.state === 'applied' && (
                    <>
                      <span className="ok-tag">✓ Applied · version {m.versionId}</span>
                      {m.previousVersion != null && <button className="btn ghost" onClick={() => undo(m)}>Undo</button>}
                    </>
                  )}
                  {m.state === 'undoing' && <span className="muted small">Restoring…</span>}
                  {m.state === 'undone' && <span className="muted small">↩ Undone</span>}
                  {m.state === 'discarded' && <span className="muted small">Discarded</span>}
                </div>
              </div>
            )}
            {m.txs && (
              <TxProposal m={m} content={store.content} onAdd={() => addTxs(m)} onDiscard={() => update(m.id, { txState: 'discarded' })} />
            )}
            {m.highlights && <ul className="ticks chat-ticks">{m.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
            {m.suggestions && <SuggestionList suggestions={m.suggestions} onDo={(a) => send(a)} />}
            {m.news && <NewsList items={m.news} sources={m.sources} />}
            <div className="msg-foot">
              {m.provider && <span className="via mono">via {m.provider}</span>}
              {m.role === 'assistant' && canSpeak && !m.error && (
                <button className="speak-btn" onClick={() => speak([m.content, ...(m.highlights || [])].join('. '))} aria-label="Read aloud">🔊</button>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="msg assistant typing"><span /><span /><span /></div>}
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input) }}>
        <VoiceButton
          disabled={busy}
          onText={(t) => { setVoiceError(''); setFromVoice(true); setInput((v) => (v ? `${v} ${t}` : t)); inputRef.current?.focus() }}
          onError={setVoiceError}
        />
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          placeholder="e.g. Move Deep Work II to 20:00 on weekdays"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          enterKeyHint="send"
        />
        <button className="btn primary" disabled={busy || !input.trim()} aria-label="Send">➤</button>
      </form>
      {voiceError && <p className="form-error small">{voiceError}</p>}
      {messages.length > 0 && <button className="link-btn" onClick={() => setMessages([])}>Clear chat</button>}
    </div>
  )
}

// ---------------------------------------------------------------- history
function History() {
  const store = useContentStore()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)

  const load = () => store.listVersions(40).then(setRows).catch((e) => setError(e.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [store.version])

  async function restore(id) {
    if (!window.confirm(`Restore version ${id}? Your current version stays in history.`)) return
    setBusy(id)
    try {
      await store.restore(id)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (error) return <p className="form-error">{error}</p>
  if (!rows) return <p className="muted small">Loading…</p>
  return (
    <ul className="versions">
      {rows.map((r) => (
        <li key={r.id} className={r.id === store.version ? 'current' : ''}>
          <div>
            <b>v{r.id}</b> <span className={`src ${r.source}`}>{r.source}</span>
            <p>{r.summary || '—'}</p>
            <small className="muted">{new Date(r.created_at).toLocaleString()}</small>
          </div>
          {r.id === store.version
            ? <span className="ok-tag">Live</span>
            : <button className="btn ghost" disabled={busy === r.id} onClick={() => restore(r.id)}>{busy === r.id ? '…' : 'Restore'}</button>}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- manual editor
const EDITOR_GROUPS = [
  ['Timetable', (id) => id.startsWith('schedule.') || id === 'plans'],
  ['Site & look', (id) => ['site', 'pillars', 'coreFour', 'fronts'].includes(id)],
  ['Career', (id) => ['profile', 'certs', 'english', 'domain', 'roadmap'].includes(id)],
  ['Fiverr', (id) => ['gigs', 'launch', 'fiverrRules', 'levels'].includes(id)],
  ['Content & money', (id) => ['channels', 'contentPipeline', 'contentRules', 'wealthWeeks', 'wealthGuardrails', 'finance'].includes(id)],
  ['Habits & research', (id) => ['scorecard', 'scorecardWin', 'legends', 'principles'].includes(id)],
]
function Editor() {
  const store = useContentStore()
  const [section, setSection] = useState('roadmap')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState([])
  const [saved, setSaved] = useState('')

  useEffect(() => {
    setText(JSON.stringify(getAt(store.content, section), null, 2))
    setErrors([])
    setSaved('')
  }, [section, store.version]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaved('')
    let value
    try {
      value = JSON.parse(text)
    } catch (e) {
      setErrors([`Not valid JSON: ${e.message}`])
      return
    }
    const next = setAt(store.content, section, value)
    const errs = section === 'pillars' ? validateContent(next) : validateSection(section, value, next)
    setErrors(errs)
    if (errs.length) return
    try {
      const id = await store.save(next, `Edited ${SECTIONS[section].label}`, 'manual')
      setSaved(`Saved as version ${id}`)
    } catch (e) {
      setErrors([e.message])
    }
  }

  return (
    <div className="editor">
      <select value={section} onChange={(e) => setSection(e.target.value)}>
        {EDITOR_GROUPS.map(([group, test]) => (
          <optgroup key={group} label={group}>
            {SECTION_IDS.filter(test).map((id) => <option key={id} value={id}>{SECTIONS[id].label}</option>)}
          </optgroup>
        ))}
      </select>
      <textarea spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      {errors.length > 0 && <ul className="form-error">{errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>}
      {saved && <p className="ok-tag">{saved}</p>}
      <div className="proposal-actions">
        <button className="btn primary" onClick={save}>Validate & save</button>
        <button className="btn ghost" onClick={() => setText(JSON.stringify(getAt(store.content, section), null, 2))}>Reset</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- shell
export default function Assistant() {
  const { isOwner } = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('chat')
  const [pending, setPending] = useState(null)

  useEffect(() => {
    const onAsk = (e) => {
      setOpen(true)
      setTab('chat')
      setPending({ text: e.detail, at: Date.now() })
    }
    window.addEventListener('ascend:ask', onAsk)
    return () => window.removeEventListener('ascend:ask', onAsk)
  }, [])
  if (!isOwner) return null

  return createPortal(
    <>
      <button className="ai-fab" onClick={() => setOpen(true)} aria-label="Open AI assistant">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.aside
            className="ai-panel glass"
            role="dialog"
            aria-label="AI assistant"
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
          >
            <header className="ai-head">
              <b>Assistant</b>
              <div className="ai-tabs">
                {[['chat', 'Chat'], ['history', 'History'], ['edit', 'Edit']].map(([k, l]) => (
                  <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
                ))}
              </div>
              <button className="ai-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </header>
            <div className="ai-body">
              {tab === 'chat' && <Chat pending={pending} onPendingDone={() => setPending(null)} />}
              {tab === 'history' && <History />}
              {tab === 'edit' && <Editor />}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}

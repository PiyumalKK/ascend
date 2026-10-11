import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Section from './Section'
import { useAuth } from '../lib/auth'
import { useContent } from '../lib/content'
import { useTransactions, monthRange, shiftMonth, todayKey, formatMoney } from '../lib/money'

const BAR = '#8f7bff'
const OVER = '#ff6b6b'

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function Tile({ label, value, sub, tone }) {
  return (
    <div className={`tile ${tone || ''}`}>
      <span className="tile-label">{label}</span>
      <b className="tile-value mono">{value}</b>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  )
}

function AddForm({ fin, onAdd }) {
  const [kind, setKind] = useState('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(fin.currency)
  const [category, setCategory] = useState(fin.categories[0].key)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayKey())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cats = kind === 'expense' ? fin.categories : fin.incomeCategories

  function switchKind(k) {
    setKind(k)
    setCategory((k === 'expense' ? fin.categories : fin.incomeCategories)[0].key)
  }

  async function submit(e) {
    e.preventDefault()
    const value = Number(String(amount).replace(/,/g, ''))
    if (!(value > 0)) {
      setError('Enter an amount above zero.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onAdd({ kind, amount: value, currency, category, note: note.trim() || null, occurred_on: date, source: 'manual' })
      setAmount('')
      setNote('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="glass card add-tx" onSubmit={submit}>
      <div className="seg">
        <button type="button" className={kind === 'expense' ? 'on' : ''} onClick={() => switchKind('expense')}>Expense</button>
        <button type="button" className={kind === 'income' ? 'on' : ''} onClick={() => switchKind('income')}>Income</button>
      </div>
      <div className="amount-row">
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
          {[...new Set([fin.currency, 'LKR', 'USD'])].map((c) => <option key={c}>{c}</option>)}
        </select>
        <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
      </div>
      <div className="cat-chips" role="radiogroup" aria-label="Category">
        {cats.map((c) => (
          <button type="button" key={c.key} role="radio" aria-checked={category === c.key} className={category === c.key ? 'on' : ''} style={{ '--cc': c.color }} onClick={() => setCategory(c.key)}>
            <span>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      <div className="note-row">
        <input placeholder="Note (optional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
      </div>
      {error && <p className="form-error small">{error}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : kind === 'expense' ? 'Add expense' : 'Add income'}</button>
      <p className="muted small">Tip: or tell the assistant, “spent 1200 on lunch”.</p>
    </form>
  )
}

function CategoryBars({ fin, spentBy, currency }) {
  const rows = fin.categories
    .map((c) => ({ ...c, spent: spentBy[c.key] || 0 }))
    .filter((c) => c.spent > 0 || c.budget)
    .sort((a, b) => b.spent - a.spent)
  const max = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.budget || 0)))
  if (!rows.length) return <p className="muted small">No spending this month yet.</p>
  return (
    <ul className="cat-bars">
      {rows.map((r) => {
        const over = r.budget && r.spent > r.budget
        return (
          <li key={r.key}>
            <span className="cat-name"><span aria-hidden="true">{r.icon}</span> {r.label}</span>
            <div className="cat-track" title={`${r.label}: ${formatMoney(r.spent, currency)}${r.budget ? ` of ${formatMoney(r.budget, currency)}` : ''}`}>
              <motion.div className="cat-fill" style={{ background: over ? OVER : BAR }} initial={{ width: 0 }} animate={{ width: `${(r.spent / max) * 100}%` }} transition={{ duration: 0.6 }} />
              {r.budget ? <span className="cat-budget" style={{ left: `${(r.budget / max) * 100}%` }} /> : null}
            </div>
            <span className="cat-val mono">
              {formatMoney(r.spent, currency)}
              {over && <span className="over-tag"> ⚠ over</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function DailyBars({ monthKey, daily, currency }) {
  const { days } = monthRange(monthKey)
  const values = Array.from({ length: days }, (_, i) => daily[i + 1] || 0)
  const max = Math.max(1, ...values)
  const [hover, setHover] = useState(null)
  const W = 100 / days
  return (
    <div className="daily" onMouseLeave={() => setHover(null)}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="daily-svg" role="img" aria-label="Daily spending this month">
        {values.map((v, i) => {
          const h = v ? Math.max(1.2, (v / max) * 38) : 0
          return (
            <g key={i}>
              {/* Hit target spans the full column, larger than the bar. */}
              <rect x={i * W} y="0" width={W} height="40" fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              {h > 0 && <rect x={i * W + W * 0.18} y={40 - h} width={W * 0.64} height={h} rx="0.6" fill={hover === i ? '#b8a9ff' : BAR} pointerEvents="none" />}
            </g>
          )
        })}
      </svg>
      <div className="daily-axis mono"><span>1</span><span>{Math.ceil(days / 2)}</span><span>{days}</span></div>
      {hover != null && (
        <div className="daily-tip" style={{ left: `${Math.min(88, Math.max(4, (hover + 0.5) * W))}%` }}>
          <b>{monthLabel(monthKey).split(' ')[0]} {hover + 1}</b>
          <span className="mono">{formatMoney(values[hover], currency)}</span>
        </div>
      )}
    </div>
  )
}

function toCSV(rows) {
  const head = ['date', 'kind', 'amount', 'currency', 'category', 'note', 'source']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [head.join(','), ...rows.map((r) => [r.occurred_on, r.kind, r.amount, r.currency, r.category, r.note, r.source].map(esc).join(','))].join('\n')
}

export default function Money() {
  const { isOwner, enabled } = useAuth()
  const content = useContent()
  const fin = content.finance
  const [monthKey, setMonthKey] = useState(todayKey().slice(0, 7))
  const { rows, loading, error, add, remove } = useTransactions(monthKey)
  const catMeta = useMemo(() => Object.fromEntries([...fin.categories, ...fin.incomeCategories].map((c) => [c.key, c])), [fin])

  const stats = useMemo(() => {
    const base = rows.filter((r) => r.currency === fin.currency)
    const spent = base.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0)
    const income = base.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount, 0)
    const spentBy = {}
    const daily = {}
    for (const r of base.filter((x) => x.kind === 'expense')) {
      spentBy[r.category] = (spentBy[r.category] || 0) + r.amount
      const d = Number(r.occurred_on.slice(8, 10))
      daily[d] = (daily[d] || 0) + r.amount
    }
    const foreign = {}
    for (const r of rows.filter((x) => x.currency !== fin.currency)) {
      const k = `${r.kind}:${r.currency}`
      foreign[k] = (foreign[k] || 0) + r.amount
    }
    return { spent, income, spentBy, daily, foreign }
  }, [rows, fin.currency])

  const isCurrent = monthKey === todayKey().slice(0, 7)
  const dayOfMonth = isCurrent ? Number(todayKey().slice(8, 10)) : monthRange(monthKey).days
  const budgetLeft = fin.monthlyBudget ? fin.monthlyBudget - stats.spent : null
  const foreignNote = Object.entries(stats.foreign).map(([k, v]) => `${k.split(':')[0] === 'income' ? '+' : '−'}${formatMoney(v, k.split(':')[1])}`).join(' · ')

  function exportCSV() {
    const blob = new Blob([toCSV(rows)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ascend-money-${monthKey}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Section id="money" kicker="06 · Money" title="Know where every rupee goes" intro="Expenses and income, private to you. Add them here, or just tell the assistant.">
      {!isOwner ? (
        <div className="glass card locked">
          <span className="lock-big" aria-hidden="true">🔒</span>
          <p><b>Private.</b> {enabled ? 'Only the owner can see and track finances. Sign in to open it.' : 'Finance tracking needs the cloud connection.'}</p>
        </div>
      ) : (
        <>
          <div className="month-bar">
            <button className="btn ghost" onClick={() => setMonthKey(shiftMonth(monthKey, -1))} aria-label="Previous month">‹</button>
            <b>{monthLabel(monthKey)}</b>
            <button className="btn ghost" onClick={() => setMonthKey(shiftMonth(monthKey, 1))} disabled={isCurrent} aria-label="Next month">›</button>
            {loading && <span className="muted small">Loading…</span>}
            <button className="btn ghost export" onClick={exportCSV} disabled={!rows.length}>Export CSV</button>
          </div>
          {error && <p className="form-error">{error}</p>}

          <div className="tiles">
            <Tile label="Spent" value={formatMoney(stats.spent, fin.currency)} sub={`${formatMoney(stats.spent / Math.max(1, dayOfMonth), fin.currency)} / day`} />
            <Tile label="Income" value={formatMoney(stats.income, fin.currency)} sub={foreignNote || ' '} />
            <Tile label="Net" value={formatMoney(stats.income - stats.spent, fin.currency)} tone={stats.income - stats.spent < 0 ? 'neg' : 'pos'} sub={stats.income - stats.spent < 0 ? '▼ spending more than earning' : '▲ saving'} />
            <Tile
              label="Budget left"
              value={budgetLeft == null ? '—' : formatMoney(budgetLeft, fin.currency)}
              tone={budgetLeft != null && budgetLeft < 0 ? 'neg' : ''}
              sub={budgetLeft == null ? 'Set one via the assistant' : `of ${formatMoney(fin.monthlyBudget, fin.currency)}`}
            />
          </div>

          <div className="panel-grid money-grid">
            <AddForm fin={fin} onAdd={add} />
            <div className="stack">
              <div className="glass card">
                <h3>Spending by category</h3>
                <CategoryBars fin={fin} spentBy={stats.spentBy} currency={fin.currency} />
              </div>
              <div className="glass card">
                <h3>Daily spending</h3>
                <DailyBars monthKey={monthKey} daily={stats.daily} currency={fin.currency} />
              </div>
            </div>
          </div>

          <div className="glass card tx-card">
            <h3>Transactions <span className="muted small">({rows.length})</span></h3>
            {rows.length === 0 ? (
              <p className="muted small">Nothing recorded for {monthLabel(monthKey)}.</p>
            ) : (
              <ul className="tx-list">
                <AnimatePresence initial={false}>
                  {rows.map((r) => {
                    const c = catMeta[r.category] || { label: r.category, icon: '•' }
                    return (
                      <motion.li key={r.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }}>
                        <span className="tx-icon" aria-hidden="true">{c.icon}</span>
                        <div className="tx-main">
                          <b>{r.note || c.label}</b>
                          <small className="muted">{c.label} · {r.occurred_on}{r.source !== 'manual' ? ` · via ${r.source}` : ''}</small>
                        </div>
                        <span className={`tx-amt mono ${r.kind}`}>{r.kind === 'income' ? '+' : '−'}{formatMoney(r.amount, r.currency)}</span>
                        <button className="tx-del" aria-label="Delete" onClick={() => window.confirm('Delete this entry?') && remove(r.id)}>✕</button>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </>
      )}
    </Section>
  )
}

// Owner-only transactions (expenses and income) with live sync.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

export function monthRange(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(last).padStart(2, '0')}`, days: last }
}

export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function todayKey() {
  // Sri Lanka date, regardless of the device timezone.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency, maximumFractionDigits: currency === 'LKR' ? 0 : 2 }).format(amount)
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`
  }
}

export function useTransactions(monthKey) {
  const { isOwner, user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { from, to } = monthRange(monthKey)

  const load = useCallback(async () => {
    if (!isOwner) {
      setRows([])
      return
    }
    setLoading(true)
    const { data, error: e } = await supabase
      .from('transactions')
      .select('id, kind, amount, currency, category, note, occurred_on, source, created_at')
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
    setLoading(false)
    if (e) setError(e.message)
    else {
      setError('')
      setRows(data.map((r) => ({ ...r, amount: Number(r.amount) })))
    }
  }, [isOwner, from, to])

  useEffect(() => {
    load()
    if (!isOwner) return
    const channel = supabase
      .channel(`transactions:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, isOwner, user])

  const add = useCallback(
    async (tx) => {
      const { error: e } = await supabase.from('transactions').insert({ user_id: user.id, ...tx })
      if (e) throw e
      await load()
    },
    [user, load],
  )

  const addMany = useCallback(
    async (list) => {
      const { error: e } = await supabase.from('transactions').insert(list.map((tx) => ({ user_id: user.id, ...tx })))
      if (e) throw e
      await load()
    },
    [user, load],
  )

  const remove = useCallback(
    async (id) => {
      const { error: e } = await supabase.from('transactions').delete().eq('id', id)
      if (e) throw e
      setRows((rs) => rs.filter((r) => r.id !== id))
    },
    [],
  )

  return { rows, loading, error, add, addMany, remove, reload: load }
}

/** Insert transactions from anywhere (e.g. the assistant), without a month view mounted. */
export async function insertTransactions(userId, list) {
  const { error } = await supabase.from('transactions').insert(list.map((tx) => ({ user_id: userId, ...tx })))
  if (error) throw error
}

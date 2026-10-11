// Cloud-synced state for the owner; read-only defaults for everyone else.
//
// Owner flow: render instantly from a per-user localStorage cache → fetch from Supabase →
// debounce writes back → apply realtime changes from other devices.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

// ---------------------------------------------------------------- sync status
let status = 'idle' // idle | saving | synced | offline | error
let pending = 0
const listeners = new Set()
function setStatus(s) {
  status = s
  listeners.forEach((l) => l())
}
function beginWrite() {
  pending++
  setStatus('saving')
}
function endWrite(error) {
  pending = Math.max(0, pending - 1)
  if (error) setStatus(navigator.onLine ? 'error' : 'offline')
  else if (pending === 0) setStatus('synced')
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => status,
  )
}

// ---------------------------------------------------------------- local cache
function readCache(k, fallback) {
  try {
    const raw = localStorage.getItem(k)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}
function writeCache(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------- app_state
/**
 * Returns [value, setValue, canEdit].
 * - Owner: persisted to app_state and synced live.
 * - Visitor: `viewOnly: true` keys are read-only; others are session-local (e.g. plan toggle).
 */
export function useCloudState(key, initial, { viewOnly = false } = {}) {
  const { user, isOwner } = useAuth()
  const uid = isOwner ? user.id : null
  const cacheKey = uid ? `ascend.${uid}.${key}` : null
  const [value, setValue] = useState(() => (cacheKey ? readCache(cacheKey, initial) : initial))
  const timer = useRef(null)
  const latest = useRef(value)
  latest.current = value

  // Load (and migrate pre-sign-in localStorage data) whenever the owner changes.
  useEffect(() => {
    if (!uid) {
      setValue(initial)
      return
    }
    setValue(readCache(cacheKey, initial))
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('app_state').select('value').eq('key', key).maybeSingle()
      if (cancelled || error) return
      if (data) {
        setValue(data.value)
        writeCache(cacheKey, data.value)
      } else {
        // First sign-in on this device: upload what was stored before sync existed.
        const legacy = readCache(`ascend.${key}`, undefined)
        if (legacy !== undefined) {
          setValue(legacy)
          writeCache(cacheKey, legacy)
          await supabase.from('app_state').upsert({ user_id: uid, key, value: legacy })
        }
      }
    })()

    const channel = supabase
      .channel(`app_state:${key}:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: `user_id=eq.${uid}` }, (payload) => {
        if (payload.new?.key === key && JSON.stringify(payload.new.value) !== JSON.stringify(latest.current)) {
          setValue(payload.new.value)
          writeCache(cacheKey, payload.new.value)
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key])

  const set = useCallback(
    (next) => {
      if (!uid && viewOnly) return
      setValue((prev) => {
        const v = typeof next === 'function' ? next(prev) : next
        latest.current = v
        if (uid) {
          writeCache(cacheKey, v)
          clearTimeout(timer.current)
          timer.current = setTimeout(async () => {
            beginWrite()
            const { error } = await supabase.from('app_state').upsert({ user_id: uid, key, value: v })
            endWrite(error)
          }, 400)
        }
        return v
      })
    },
    [uid, cacheKey, key, viewOnly],
  )

  return [value, set, !!uid || !viewOnly]
}

// ---------------------------------------------------------------- scorecard
export function useScorecardLog(days = 35) {
  const { user, isOwner } = useAuth()
  const uid = isOwner ? user.id : null
  const cacheKey = uid ? `ascend.${uid}.scorecard` : null
  const [log, setLog] = useState(() => (cacheKey ? readCache(cacheKey, {}) : {}))
  const logRef = useRef(log)
  logRef.current = log

  useEffect(() => {
    if (!uid) {
      setLog({})
      return
    }
    setLog(readCache(cacheKey, {}))
    let cancelled = false
    const since = new Date()
    since.setDate(since.getDate() - days)
    ;(async () => {
      const { data, error } = await supabase
        .from('scorecard_days')
        .select('day, items')
        .gte('day', since.toISOString().slice(0, 10))
      if (cancelled || error) return
      const next = Object.fromEntries(data.map((r) => [r.day, r.items]))
      if (data.length === 0) {
        // Migrate the old localStorage scorecard once.
        const legacy = readCache('ascend.scorecard', null)
        if (legacy && Object.keys(legacy).length) {
          const rows = Object.entries(legacy).map(([day, items]) => ({
            user_id: uid, day, items, score: Object.values(items).filter(Boolean).length,
          }))
          await supabase.from('scorecard_days').upsert(rows)
          Object.assign(next, legacy)
        }
      }
      setLog(next)
      writeCache(cacheKey, next)
    })()

    const channel = supabase
      .channel(`scorecard_days:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scorecard_days', filter: `user_id=eq.${uid}` }, (payload) => {
        if (!payload.new?.day) return
        setLog((prev) => {
          const next = { ...prev, [payload.new.day]: payload.new.items }
          writeCache(cacheKey, next)
          return next
        })
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [uid, cacheKey, days])

  const toggle = useCallback(
    async (dayKey, itemId) => {
      if (!uid) return
      const items = { ...(logRef.current[dayKey] || {}), [itemId]: !logRef.current[dayKey]?.[itemId] }
      const next = { ...logRef.current, [dayKey]: items }
      setLog(next)
      writeCache(cacheKey, next)
      beginWrite()
      const { error } = await supabase.from('scorecard_days').upsert({
        user_id: uid, day: dayKey, items, score: Object.values(items).filter(Boolean).length,
      })
      endWrite(error)
    },
    [uid, cacheKey],
  )

  return { log, toggle, canEdit: !!uid }
}

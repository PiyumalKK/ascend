import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { DEFAULT_CONTENT } from '../data/defaults'
import { validateContent, fillDefaults } from '../../supabase/functions/_shared/content-schema.js'

const CACHE_KEY = 'ascend.content.v1'
const ContentContext = createContext(null)

// Fill sections that older documents lack (new features add sections over time).
function withDefaults(content) {
  return fillDefaults(content, DEFAULT_CONTENT)
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.content ? parsed : null
  } catch {
    return null
  }
}

function writeCache(entry) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    /* ignore */
  }
}

export function ContentProvider({ children }) {
  const { isOwner, user } = useAuth()
  const cached = readCache()
  const [state, setState] = useState(() => ({
    content: withDefaults(cached?.content || DEFAULT_CONTENT),
    version: cached?.version ?? null,
    loaded: false,
  }))

  const apply = useCallback((row) => {
    const errors = validateContent(withDefaults(row.content))
    if (errors.length) {
      console.error('Stored content failed validation; keeping current content.', errors)
      return
    }
    const filled = withDefaults(row.content)
    const entry = { content: filled, version: row.id }
    writeCache(entry)
    // Remember when the stored document predates new sections, so the owner can save it once.
    setState({ ...entry, loaded: true, outdated: JSON.stringify(filled) !== JSON.stringify(row.content) })
  }, [])

  // Load the newest version and follow new versions live.
  useEffect(() => {
    if (!supabase) {
      setState((s) => ({ ...s, loaded: true }))
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('content_versions')
        .select('id, content')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setState((s) => ({ ...s, loaded: true }))
        return
      }
      if (data) apply(data)
      else setState((s) => ({ ...s, loaded: true }))
    })()

    const channel = supabase
      .channel(`content_versions:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'content_versions' }, (payload) => {
        if (payload.new?.content) apply(payload.new)
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [apply])

  // First owner sign-in: store the defaults as version 1.
  useEffect(() => {
    if (!isOwner || !state.loaded || state.version !== null) return
    ;(async () => {
      const { count } = await supabase.from('content_versions').select('id', { count: 'exact', head: true })
      if (count === 0) {
        const { data } = await supabase
          .from('content_versions')
          .insert({ user_id: user.id, content: DEFAULT_CONTENT, summary: 'Initial content', source: 'seed' })
          .select('id, content')
          .single()
        if (data) apply(data)
      }
    })()
  }, [isOwner, user, state.loaded, state.version, apply])

  // Store the upgraded document once, so the server and history see every section.
  useEffect(() => {
    if (!isOwner || !state.outdated || state.version == null) return
    supabase
      .from('content_versions')
      .insert({ user_id: user.id, content: state.content, summary: 'App update: added new sections', source: 'seed' })
      .select('id, content')
      .single()
      .then(({ data }) => data && apply(data))
  }, [isOwner, user, state.outdated, state.version, state.content, apply])

  const save = useCallback(
    async (content, summary, source = 'manual') => {
      if (!isOwner) throw new Error('Only the owner can edit content.')
      const errors = validateContent(content)
      if (errors.length) throw new Error(errors.slice(0, 6).join('\n'))
      const { data, error } = await supabase
        .from('content_versions')
        .insert({ user_id: user.id, content, summary: summary.slice(0, 500), source })
        .select('id, content')
        .single()
      if (error) throw error
      apply(data)
      return data.id
    },
    [isOwner, user, apply],
  )

  const listVersions = useCallback(async (limit = 30) => {
    const { data, error } = await supabase
      .from('content_versions')
      .select('id, summary, source, created_at')
      .order('id', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data
  }, [])

  const restore = useCallback(
    async (id) => {
      const { data, error } = await supabase.from('content_versions').select('content, summary').eq('id', id).single()
      if (error) throw error
      return save(withDefaults(data.content), `Restored version ${id}${data.summary ? ` (${data.summary})` : ''}`, 'restore')
    },
    [save],
  )

  const value = useMemo(
    () => ({ ...state, save, listVersions, restore }),
    [state, save, listVersions, restore],
  )
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContentStore() {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContentStore must be used inside <ContentProvider>')
  return ctx
}

/** Shortcut for components that only read. */
export function useContent() {
  return useContentStore().content
}

/** Pillar lookup that never crashes on an unknown key. */
export function pillarOf(content, key) {
  return content.pillars[key] || { label: key, color: '#7d8bb0', icon: '•' }
}

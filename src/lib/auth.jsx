import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, OWNER_EMAIL } from './supabase'

const AuthContext = createContext(null)
const REVALIDATE_MS = 10 * 60 * 1000

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!supabase)
  const [expired, setExpired] = useState(false)

  // A stored session can be revoked server-side (sign-out elsewhere, password change).
  // Ask the server whether it is still valid; if not, drop it locally and say so.
  const revalidate = useCallback(async () => {
    if (!supabase) return true
    const { data } = await supabase.auth.getSession()
    if (!data.session) return false
    const { error } = await supabase.auth.getUser()
    if (!error) return true
    // Only treat auth rejections as expiry; network errors keep the session (offline use).
    if (error.status === 401 || error.status === 403 || /session|jwt|token/i.test(error.message)) {
      await supabase.auth.signOut({ scope: 'local' })
      setSession(null)
      setExpired(true)
      return false
    }
    return true
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
      if (data.session) revalidate()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN') setExpired(false)
    })

    // Re-check when the app comes back to the foreground (phones keep tabs alive for days).
    let last = Date.now()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > REVALIDATE_MS) {
        last = Date.now()
        revalidate()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [revalidate])

  const value = useMemo(() => {
    const user = session?.user ?? null
    const isOwner = !!user && user.email?.toLowerCase() === OWNER_EMAIL
    return {
      ready,
      enabled: !!supabase,
      session,
      user,
      isOwner,
      expired,
      dismissExpired: () => setExpired(false),
      revalidate,
      async signIn(email, password) {
        if (!supabase) throw new Error('Sync is not configured on this deployment.')
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setExpired(false)
      },
      async signOut() {
        // This device only; other signed-in devices stay signed in.
        await supabase?.auth.signOut({ scope: 'local' })
      },
    }
  }, [session, ready, expired, revalidate])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

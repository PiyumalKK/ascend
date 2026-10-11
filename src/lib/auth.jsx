import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, OWNER_EMAIL } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo(() => {
    const user = session?.user ?? null
    const isOwner = !!user && user.email?.toLowerCase() === OWNER_EMAIL
    return {
      ready,
      enabled: !!supabase,
      session,
      user,
      isOwner,
      async signIn(email, password) {
        if (!supabase) throw new Error('Sync is not configured on this deployment.')
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      },
      async signOut() {
        await supabase?.auth.signOut()
      },
    }
  }, [session, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

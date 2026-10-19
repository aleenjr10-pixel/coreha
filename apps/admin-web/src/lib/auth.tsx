import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorMessage, supabase, supabaseConfigured } from './supabase'
import type { Profile } from './types'

type AuthState = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(!supabaseConfigured)
  const [profile, setProfile] = useState<Profile | null>(null)
  // The user id the profile state belongs to, so a new sign-in never renders a stale profile.
  const [profileFor, setProfileFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setSessionLoaded(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    let active = true
    supabase
      .from('profiles')
      .select('id, email, full_name, phone, role')
      .eq('id', userId)
      .maybeSingle<Profile>()
      .then(({ data, error: profileError }) => {
        if (!active) return
        setProfile(data)
        setError(profileError ? errorMessage(profileError, 'Unable to load your profile.') : null)
        setProfileFor(userId)
      })
    return () => {
      active = false
    }
  }, [userId])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
  }, [])

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError
  }, [])

  return (
    <AuthContext.Provider
      value={{
        loading: !sessionLoaded || (userId !== null && profileFor !== userId),
        session,
        // Only expose the profile that belongs to the current session.
        profile: profileFor === userId ? profile : null,
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

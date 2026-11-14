import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../services/api'
import * as authService from '../services/auth.service'
import type { User } from '../types/user'
import { getErrorCode } from '../utils/apiError'
import { AuthContext, type AuthStatus } from './authContextValue'

/**
 * Keeps track of who is logged in. The login itself lives in an HTTP-only cookie the
 * page's code cannot read, and the backend checks it on every request.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isCurrent = true

    authService
      .fetchSession()
      .then((sessionUser) => {
        if (!isCurrent) return
        setUser(sessionUser)
        setStatus('ready')
      })
      .catch(() => {
        if (isCurrent) setStatus('unavailable')
      })

    return () => {
      isCurrent = false
    }
  }, [attempt])

  // If the backend ends a session (expired or deactivated), return to the logged-out state.
  useEffect(() => {
    const interceptor = api.interceptors.response.use(undefined, (error: unknown) => {
      const code = getErrorCode(error)
      if (code === 'NOT_AUTHENTICATED') setUser(null)
      if (code === 'PASSWORD_CHANGE_REQUIRED') {
        setUser((current) => (current ? { ...current, mustChangePassword: true } : current))
      }
      return Promise.reject(error)
    })

    return () => api.interceptors.response.eject(interceptor)
  }, [])

  const login = useCallback<typeof authService.login>(async (input) => {
    const loggedIn = await authService.login(input)
    setUser(loggedIn)
    setStatus('ready')
    return loggedIn
  }, [])

  const register = useCallback<typeof authService.register>(async (input) => {
    const created = await authService.register(input)
    setUser(created)
    setStatus('ready')
    return created
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const retrySession = useCallback(() => {
    setStatus('loading')
    setAttempt((current) => current + 1)
  }, [])

  const value = useMemo(
    () => ({ user, status, login, register, logout, retrySession, setUser }),
    [user, status, login, register, logout, retrySession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

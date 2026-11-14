import { createContext } from 'react'
import type { LoginInput, RegisterInput } from '../services/auth.service'
import type { User } from '../types/user'

// 'unavailable' means the server could not be reached, which is different from being logged out.
export type AuthStatus = 'loading' | 'ready' | 'unavailable'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (input: LoginInput) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
  retrySession: () => void
  setUser: (user: User | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

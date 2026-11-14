import { createContext } from 'react'

export type ToastTone = 'success' | 'error'

export type ShowToast = (message: string, tone?: ToastTone) => void

export const ToastContext = createContext<ShowToast | null>(null)

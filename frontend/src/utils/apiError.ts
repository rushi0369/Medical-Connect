import axios from 'axios'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

interface ErrorBody {
  error?: {
    code?: string
    message?: string
    details?: { fieldErrors?: Record<string, string[]> }
  }
}

const NO_CONNECTION_MESSAGE = 'We cannot reach the server. Please check your internet connection and try again.'
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.'

function errorBody(error: unknown): ErrorBody['error'] | undefined {
  return axios.isAxiosError<ErrorBody>(error) ? error.response?.data?.error : undefined
}

export function getErrorCode(error: unknown) {
  return errorBody(error)?.code
}

export function getErrorMessage(error: unknown, fallback: string = FALLBACK_MESSAGE) {
  if (axios.isAxiosError(error) && !error.response) return NO_CONNECTION_MESSAGE
  return errorBody(error)?.message ?? fallback
}

/** Shows the server's validation messages beside their fields. Returns true if any were shown. */
export function applyFieldErrors<Values extends FieldValues>(error: unknown, setError: UseFormSetError<Values>) {
  const fieldErrors = errorBody(error)?.details?.fieldErrors
  if (!fieldErrors) return false

  const entries = Object.entries(fieldErrors)
  for (const [field, messages] of entries) {
    setError(field as Path<Values>, { type: 'server', message: messages[0] })
  }
  return entries.length > 0
}

import { z } from 'zod'

// These match the backend rules, so people see problems straight away. The backend
// still checks everything again, because anything in the browser can be bypassed.

const PHONE_FORMAT = /^(?:\+?91|0)?[6-9]\d{9}$/

export const phoneField = z
  .string()
  .trim()
  .refine((value) => PHONE_FORMAT.test(value.replace(/[\s()-]/g, '')), 'Enter a valid 10-digit Indian mobile number.')

export const optionalEmailField = z
  .string()
  .trim()
  .refine((value) => value === '' || z.email().safeParse(value).success, 'Enter a valid email address.')

export const requiredText = (message: string) => z.string().trim().min(1, message)

export const newPasswordField = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'Use at most 72 characters.')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'Use at least one letter and one number.')

export const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.'

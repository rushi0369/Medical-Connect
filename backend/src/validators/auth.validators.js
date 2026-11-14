import { z } from 'zod';
import { addressSchema, fullNameSchema, newPasswordSchema, optionalEmailSchema, phoneSchema } from './common.js';

const identifierSchema = z
  .string('Enter your email or mobile number.')
  .trim()
  .min(1, 'Enter your email or mobile number.')
  .max(254, 'That email or mobile number is too long.');

// There is no role field: unknown fields are dropped, and registration always creates a customer.
export const registerSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
  password: newPasswordSchema,
  address: addressSchema,
});

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string('Enter your password.').min(1, 'Enter your password.').max(200),
  rememberMe: z.boolean().default(false),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string('Enter your current password.').min(1, 'Enter your current password.').max(200),
    newPassword: newPasswordSchema,
  })
  .refine((body) => body.currentPassword !== body.newPassword, {
    path: ['newPassword'],
    message: 'Your new password must be different from your current one.',
  });

export const forgotPasswordSchema = z.object({ identifier: identifierSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().optional(),
    identifier: identifierSchema.optional(),
    otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code.').optional(),
    newPassword: newPasswordSchema,
  })
  .refine((data) => data.token || (data.identifier && data.otp), {
    path: ['otp'],
    message: 'Either a reset link or a verification code (OTP) is required.',
  });

import { z } from 'zod';

const blankToUndefined = (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
// For edits, where a blank field means "remove this value".
const blankToNull = (value) => (typeof value === 'string' && value.trim() === '' ? null : value);

/** Turns forms like "+91 98765 43210" or "09876543210" into 9876543210. Returns null if invalid. */
export function normalizePhone(value) {
  const match = value.replace(/[\s()-]/g, '').match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return match ? match[1] : null;
}

export const phoneSchema = z
  .string('Enter your mobile number.')
  .transform((value, context) => {
    const phone = normalizePhone(value);
    if (!phone) {
      context.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number.' });
      return z.NEVER;
    }
    return phone;
  });

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.').max(254, 'That email address is too long.'));

export const optionalEmailSchema = z.preprocess(blankToUndefined, emailSchema.optional());
export const requiredEmailSchema = z.string('Enter your email address.').pipe(emailSchema);
export const editableEmailSchema = z.preprocess(blankToNull, emailSchema.nullable().optional());

export const fullNameSchema = z
  .string('Enter a full name.')
  .trim()
  .min(2, 'Enter a full name.')
  .max(100, 'That name is too long.');

/** Rules for any newly chosen password. bcrypt only reads the first 72 bytes, so longer is refused. */
export const newPasswordSchema = z
  .string('Enter a password.')
  .min(8, 'Use at least 8 characters.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Use at most 72 characters.')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'Use at least one letter and one number.');

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'That ID is not valid.');

export const idParamsSchema = z.object({ id: objectIdSchema });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const addressSchema = z.object({
  label: z.preprocess(blankToUndefined, z.string().trim().max(50).optional()),
  fullAddress: z
    .string('Enter the full address.')
    .trim()
    .min(5, 'Enter the full address.')
    .max(300, 'That address is too long.'),
  area: z.string('Enter the area or locality.').trim().min(2, 'Enter the area or locality.').max(100),
  city: z.string('Enter the city.').trim().min(2, 'Enter the city.').max(100),
  state: z.string('Enter the state.').trim().min(2, 'Enter the state.').max(100),
  pincode: z.string('Enter the pincode.').trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode.'),
  location: z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    })
    .nullable()
    .optional(),
  deliveryInstructions: z.preprocess(blankToUndefined, z.string().trim().max(300).optional()),
});

export const optionalShortText = (max) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
export const editableShortText = (max) => z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());

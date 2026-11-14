import { z } from 'zod';
import {
  editableEmailSchema,
  editableShortText,
  fullNameSchema,
  optionalEmailSchema,
  optionalShortText,
  paginationSchema,
  phoneSchema,
} from './common.js';

export const listRidersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});

// No password field: the system generates a temporary one that is shown to the admin once.
export const createRiderSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
  vehicleNumber: optionalShortText(20),
  notes: optionalShortText(500),
});

export const updateRiderSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    phone: phoneSchema.optional(),
    email: editableEmailSchema,
    vehicleNumber: editableShortText(20),
    notes: editableShortText(500),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'There is nothing to update.',
  });

export const riderStatusSchema = z.object({
  isActive: z.boolean('Choose whether the rider is active.'),
});

export const listRiderDeliveriesQuerySchema = paginationSchema.extend({
  scope: z.enum(['active', 'history']).default('active'),
});

export const riderDeliveryActionSchema = z
  .object({
    action: z.enum(['start', 'reach', 'deliver', 'fail']),
    reason: z
      .enum(['CUSTOMER_UNAVAILABLE', 'INCORRECT_ADDRESS', 'CUSTOMER_REFUSED', 'UNABLE_TO_CONTACT', 'OTHER'])
      .optional(),
    notes: optionalShortText(300),
  })
  .refine((data) => data.action !== 'fail' || Boolean(data.reason), {
    message: 'A reason must be given when a delivery cannot be completed.',
    path: ['reason'],
  });

export const riderCollectCashSchema = z.object({
  amountPaise: z.coerce.number().int().min(1, 'Amount must be greater than zero.'),
});

export const assignRiderSchema = z.object({
  riderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid rider ID'),
});

export const adminListDeliveriesQuerySchema = paginationSchema.extend({
  scope: z.enum(['all', 'active', 'history']).default('all'),
  status: optionalShortText(50),
  riderId: optionalShortText(50),
});

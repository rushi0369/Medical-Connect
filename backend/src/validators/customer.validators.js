import { z } from 'zod';
import {
  editableEmailSchema,
  fullNameSchema,
  objectIdSchema,
  optionalShortText,
} from './common.js';

const blankToUndefined = (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

export const updateProfileSchema = z.object({
  fullName: fullNameSchema.optional(),
  email: editableEmailSchema,
});

export const saveAddressSchema = z.object({
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
  deliveryInstructions: z.preprocess(blankToUndefined, z.string().trim().max(300).optional()),
  isDefault: z.boolean().optional(),
});

export const orderItemSchema = z.object({
  description: z.string().trim().min(1, 'Enter the medicine name.').max(200),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').default(1),
});

export const createOrderSchema = z.object({
  addressId: objectIdSchema,
  customerInstructions: optionalShortText(500),
  requestedItems: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }
    return val ?? [];
  }, z.array(orderItemSchema).default([])),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a reason for cancelling.').max(300),
});

export const listCustomerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: optionalShortText(50),
  search: optionalShortText(100),
});


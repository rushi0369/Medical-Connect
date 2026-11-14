import { z } from 'zod';
import { addressSchema, objectIdSchema, optionalShortText } from './common.js';

export const saveReviewNotesSchema = z.object({
  adminRemarks: optionalShortText(500),
  requestedItems: z
    .array(
      z.object({
        id: objectIdSchema,
        isUnavailable: z.boolean(),
        alternativeNote: optionalShortText(200),
      }),
    )
    .optional(),
});

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, 'Enter the medicine description.').max(200),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').default(1),
  unitPricePaise: z.coerce.number().int().min(0, 'Unit price cannot be negative.').default(0),
  isSubstitute: z.boolean().optional().default(false),
  substituteFor: optionalShortText(200),
});

export const saveInvoiceDraftSchema = z.object({
  lineItems: z.array(invoiceLineItemSchema).min(1, 'Add at least one medicine item to the bill.'),
  discountPaise: z.coerce.number().int().min(0).default(0),
  taxPaise: z.coerce.number().int().min(0).default(0),
  deliveryChargePaise: z.coerce.number().int().min(0).default(0),
  deliveryDistanceKm: z.coerce.number().min(0).nullable().optional(),
  deliveryDurationMinutes: z.coerce.number().min(0).nullable().optional(),
  isDeliveryChargeOverridden: z.boolean().optional().default(false),
  remarks: optionalShortText(500),
});

export const approveInvoiceSchema = z.object({
  paymentMethod: z.enum(['UPI', 'CASH']),
  acceptSubstitutes: z.boolean().optional(),
});

export const rejectInvoiceSchema = z.object({
  reason: z.string().trim().min(3, 'Please provide a reason for rejecting the bill.').max(300),
});

export const adminOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: optionalShortText(50),
  search: optionalShortText(100),
});

export const adminCustomerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalShortText(100),
});

export const updateCustomerSchema = z.object({
  fullName: z.string().trim().min(1, 'Name cannot be empty.').max(100).optional(),
  phone: z.string().trim().regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits.').optional(),
  email: z.string().trim().email('Invalid email address.').optional().nullable(),
  isActive: z.boolean().optional(),
});

export const saveStoreSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(120).optional(),
  contactPhone: optionalShortText(20),
  upiId: optionalShortText(100),
  address: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return undefined;
      }
    }
    return val;
  }, addressSchema.optional()),
});

export const deliveryPricingTierSchema = z.object({
  minKm: z.coerce.number().min(0),
  maxKm: z.coerce.number().min(0).nullable().optional(),
  chargePaise: z.coerce.number().int().min(0).nullable().optional(),
});

export const saveDeliveryPricingSchema = z.object({
  tiers: z.array(deliveryPricingTierSchema).min(1, 'At least one delivery pricing tier is required.'),
});

export const adminPaymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: optionalShortText(50),
  method: optionalShortText(50),
  settlement: optionalShortText(50),
  riderId: optionalShortText(50),
});

export const settleCashSchema = z.object({
  paymentIds: z.array(objectIdSchema).min(1, 'Select at least one payment to settle.'),
});

export const refundPaymentSchema = z.object({
  reference: optionalShortText(100),
});

export const reportsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});

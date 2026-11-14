import mongoose, { Schema } from 'mongoose';
import { INVOICE_STATUS, ROLES } from '../config/constants.js';
import { lineItemSchema } from './shared/lineItem.schema.js';
import { refExists } from './shared/refExists.js';

const paiseField = { type: Number, min: 0, validate: Number.isInteger };

// Each revision is a new document, so every earlier version is preserved.
const invoiceSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, immutable: true, validate: refExists('Order') },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      validate: refExists('User', { role: ROLES.CUSTOMER }),
    },
    version: { type: Number, required: true, min: 1, immutable: true },
    status: { type: String, enum: Object.values(INVOICE_STATUS), default: INVOICE_STATUS.DRAFT },
    lineItems: {
      type: [lineItemSchema],
      validate: { validator: (items) => items.length > 0, message: 'An invoice needs at least one line item.' },
    },
    subtotalPaise: { ...paiseField, required: true },
    discountPaise: { ...paiseField, default: 0 },
    taxPaise: { ...paiseField, default: 0 },
    deliveryChargePaise: { ...paiseField, required: true },
    grandTotalPaise: { ...paiseField, required: true },
    // How the delivery charge was worked out, so the bill can be explained later.
    deliveryDistanceKm: { type: Number, min: 0 },
    deliveryDurationMinutes: { type: Number, min: 0 },
    isDeliveryChargeOverridden: { type: Boolean, default: false },
    remarks: { type: String, trim: true, maxlength: 1000 },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    sentAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
  },
  { timestamps: true },
);

invoiceSchema.index({ order: 1, version: 1 }, { unique: true });
invoiceSchema.index({ customer: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, createdAt: -1 });

invoiceSchema.pre('validate', function checkTotals() {
  const subtotal = this.lineItems.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  if (subtotal !== this.subtotalPaise) {
    this.invalidate('subtotalPaise', 'Subtotal must equal the sum of the line totals.');
  }

  const expectedTotal = this.subtotalPaise - this.discountPaise + this.taxPaise + this.deliveryChargePaise;
  if (expectedTotal !== this.grandTotalPaise) {
    this.invalidate('grandTotalPaise', 'Grand total must equal subtotal - discount + tax + delivery charge.');
  }
});

// An approved invoice is the customer's agreed bill, so its values can never change.
invoiceSchema.post('init', function rememberApproval() {
  this.$locals.wasApproved = this.status === INVOICE_STATUS.APPROVED;
});

invoiceSchema.pre('save', function protectApprovedInvoice() {
  if (this.$locals.wasApproved && this.isModified()) {
    throw new Error('An approved invoice cannot be changed. Create a new version instead.');
  }
});

const IN_PLACE_WRITES = ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne'];

// Direct database updates skip the check above, so they may never touch an approved invoice.
invoiceSchema.pre(IN_PLACE_WRITES, { query: true, document: false }, function excludeApproved() {
  this.where({ status: { $ne: INVOICE_STATUS.APPROVED } });
});

export const Invoice = mongoose.model('Invoice', invoiceSchema);

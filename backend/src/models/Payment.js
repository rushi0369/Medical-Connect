import mongoose, { Schema } from 'mongoose';
import { PAYMENT_METHOD, PAYMENT_STATUS, ROLES, SETTLEMENT_STATUS } from '../config/constants.js';
import { refExists } from './shared/refExists.js';

const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, immutable: true, validate: refExists('Order') },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      validate: refExists('User', { role: ROLES.CUSTOMER }),
    },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, validate: refExists('Invoice') },
    amountPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    method: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.UNPAID },
    // The payment gateway's transaction ID, or a reference recorded for cash.
    paymentReference: { type: String, trim: true, maxlength: 200 },
    paidAt: { type: Date },
    collectedBy: { type: Schema.Types.ObjectId, ref: 'User', validate: refExists('User', { role: ROLES.RIDER }) },
    collectedAmountPaise: { type: Number, min: 0, validate: Number.isInteger },
    collectedAt: { type: Date },
    settlementStatus: {
      type: String,
      enum: Object.values(SETTLEMENT_STATUS),
      default: SETTLEMENT_STATUS.NOT_APPLICABLE,
    },
    settledAt: { type: Date },
    settledBy: { type: Schema.Types.ObjectId, ref: 'User', validate: refExists('User', { role: ROLES.ADMIN }) },
    // The UPI payment link created at the payment gateway, if any.
    gatewayLinkId: { type: String, trim: true, maxlength: 100 },
    gatewayLinkUrl: { type: String, trim: true, maxlength: 500 },
    refundReference: { type: String, trim: true, maxlength: 200 },
    refundedAt: { type: Date },
  },
  { timestamps: true },
);

paymentSchema.index({ order: 1 });
paymentSchema.index({ customer: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ collectedBy: 1, settlementStatus: 1 });
paymentSchema.index({ gatewayLinkId: 1 }, { unique: true, partialFilterExpression: { gatewayLinkId: { $type: 'string' } } });
// A gateway reference can only be used once, so a repeated webhook cannot double-count a payment.
paymentSchema.index(
  { method: 1, paymentReference: 1 },
  { unique: true, partialFilterExpression: { paymentReference: { $type: 'string' } } },
);

paymentSchema.pre('validate', function protectVerifiedStatuses() {
  if (this.status === PAYMENT_STATUS.PAID && !this.paymentReference) {
    this.invalidate('paymentReference', 'A paid payment needs a verified payment reference.');
  }
  if (this.status === PAYMENT_STATUS.CASH_COLLECTED && !this.collectedBy) {
    this.invalidate('collectedBy', 'Collected cash must record the rider who collected it.');
  }
  if (this.status === PAYMENT_STATUS.SETTLED && !this.settledBy) {
    this.invalidate('settledBy', 'A settlement must record the admin who received the cash.');
  }
});

export const Payment = mongoose.model('Payment', paymentSchema);

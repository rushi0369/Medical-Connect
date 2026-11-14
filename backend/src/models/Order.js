import mongoose, { Schema } from 'mongoose';
import { ORDER_STATUS, ROLES } from '../config/constants.js';
import { addressSnapshotSchema } from './shared/address.schema.js';
import { lineItemSchema } from './shared/lineItem.schema.js';
import { refExists } from './shared/refExists.js';

// A customer's photo of a prescription or medicine strip.
const requestPhotoSchema = new Schema(
  {
    url: { type: String, required: true },
    storageKey: { type: String, required: true },
    originalName: { type: String, trim: true, maxlength: 255 },
  },
  { _id: true, timestamps: { createdAt: 'uploadedAt', updatedAt: false } },
);

// What the customer typed. Kept separate from the admin's billed line items.
const requestedItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    notes: { type: String, trim: true, maxlength: 300 },
    isUnavailable: { type: Boolean, default: false },
    alternativeNote: { type: String, trim: true, maxlength: 300 },
  },
  { _id: true },
);

const statusChangeSchema = new Schema(
  {
    status: { type: String, enum: Object.values(ORDER_STATUS), required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, enum: Object.values(ROLES), required: true },
    note: { type: String, trim: true, maxlength: 500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, trim: true },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      validate: refExists('User', { role: ROLES.CUSTOMER }),
    },
    addressSnapshot: { type: addressSnapshotSchema, required: true },
    requestPhotos: { type: [requestPhotoSchema], default: [] },
    requestedItems: { type: [requestedItemSchema], default: [] },
    customerInstructions: { type: String, trim: true, maxlength: 1000 },
    lineItems: { type: [lineItemSchema], default: [] },
    adminRemarks: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING_ADMIN_REVIEW,
    },
    statusHistory: { type: [statusChangeSchema], default: [] },
    currentRider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      validate: refExists('User', { role: ROLES.RIDER }),
    },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', validate: refExists('Invoice') },
    invoiceVersion: { type: Number, min: 1 },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', validate: refExists('Payment') },
    delivery: { type: Schema.Types.ObjectId, ref: 'Delivery', validate: refExists('Delivery') },
    cancellation: {
      type: new Schema(
        {
          reason: { type: String, trim: true, maxlength: 500 },
          by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          byRole: { type: String, enum: Object.values(ROLES), required: true },
          at: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ currentRider: 1, status: 1 });

orderSchema.pre('validate', function requireSomethingRequested() {
  if (this.isNew && this.requestPhotos.length === 0 && this.requestedItems.length === 0) {
    this.invalidate('requestedItems', 'An order needs at least one photo or one written medicine.');
  }
});

export const Order = mongoose.model('Order', orderSchema);

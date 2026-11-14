import mongoose, { Schema } from 'mongoose';
import { DELIVERY_FAILURE_REASON, DELIVERY_STATUS, ROLES } from '../config/constants.js';
import { refExists } from './shared/refExists.js';

// One document per assignment. Reassigning creates a new one and leaves the old as history.
const deliverySchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, immutable: true, validate: refExists('Order') },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      validate: refExists('User', { role: ROLES.CUSTOMER }),
    },
    rider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      validate: refExists('User', { role: ROLES.RIDER }),
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    status: { type: String, enum: Object.values(DELIVERY_STATUS), default: DELIVERY_STATUS.RIDER_ASSIGNED },
    isCurrent: { type: Boolean, default: true },
    assignedAt: { type: Date, default: Date.now },
    outForDeliveryAt: { type: Date },
    reachedAt: { type: Date },
    deliveredAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String, enum: Object.values(DELIVERY_FAILURE_REASON) },
    failureNotes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

// An order can only have one active assignment at a time.
deliverySchema.index({ order: 1 }, { unique: true, partialFilterExpression: { isCurrent: true } });
deliverySchema.index({ rider: 1, isCurrent: 1, status: 1 });
deliverySchema.index({ rider: 1, createdAt: -1 });
deliverySchema.index({ status: 1, createdAt: -1 });

deliverySchema.pre('validate', function requireFailureReason() {
  if (this.status === DELIVERY_STATUS.DELIVERY_FAILED && !this.failureReason) {
    this.invalidate('failureReason', 'A failed delivery needs a reason.');
  }
});

export const Delivery = mongoose.model('Delivery', deliverySchema);

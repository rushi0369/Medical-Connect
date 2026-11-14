import mongoose, { Schema } from 'mongoose';
import { DELIVERY_STATUS, ROLES } from '../config/constants.js';
import { appendOnly } from './shared/appendOnly.js';
import { refExists } from './shared/refExists.js';

// Permanent timeline of every status change on a delivery.
const deliveryEventSchema = new Schema(
  {
    delivery: { type: Schema.Types.ObjectId, ref: 'Delivery', required: true, validate: refExists('Delivery') },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(DELIVERY_STATUS), required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, enum: Object.values(ROLES), required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

deliveryEventSchema.index({ delivery: 1, createdAt: 1 });
deliveryEventSchema.index({ order: 1, createdAt: 1 });
deliveryEventSchema.index({ rider: 1, createdAt: -1 });

deliveryEventSchema.plugin(appendOnly);

export const DeliveryEvent = mongoose.model('DeliveryEvent', deliveryEventSchema);

import mongoose, { Schema } from 'mongoose';
import { SINGLETON_KEY } from '../config/constants.js';

const tierSchema = new Schema(
  {
    // Applies when minKm < road distance <= maxKm. The first tier also includes 0 km.
    minKm: { type: Number, required: true, min: 0 },
    // Left empty on the last tier, meaning "and above".
    maxKm: { type: Number, min: 0 },
    // Left empty when the admin decides the charge for each order, as for "above 12 km".
    chargePaise: { type: Number, min: 0, validate: Number.isInteger },
  },
  { _id: false },
);

// The admin's distance price list. A unique key allows only one record to exist.
const deliveryPricingSchema = new Schema(
  {
    key: { type: String, default: SINGLETON_KEY, immutable: true },
    tiers: { type: [tierSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

deliveryPricingSchema.index({ key: 1 }, { unique: true });

deliveryPricingSchema.pre('validate', function checkTiersFitTogether() {
  this.tiers.forEach((tier, index) => {
    const next = this.tiers[index + 1];
    const isLast = !next;

    if (index === 0 && tier.minKm !== 0) {
      this.invalidate('tiers', 'The first tier must start at 0 km.');
    }
    if (!isLast && tier.maxKm == null) {
      this.invalidate('tiers', 'Only the last tier can have no upper limit.');
    }
    if (tier.maxKm != null && tier.maxKm <= tier.minKm) {
      this.invalidate('tiers', 'Each tier must end after it starts.');
    }
    if (!isLast && next.minKm !== tier.maxKm) {
      this.invalidate('tiers', 'Each tier must start exactly where the previous one ends.');
    }
    if (!isLast && tier.chargePaise == null) {
      this.invalidate('tiers', 'Only the last tier can leave the charge to the admin.');
    }
  });
});

export const DeliveryPricing = mongoose.model('DeliveryPricing', deliveryPricingSchema);

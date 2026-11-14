import { Schema } from 'mongoose';

/**
 * One medicine on one bill, typed in by the admin for that order only. These exist
 * only inside an order or invoice: there is deliberately no medicine catalogue.
 */
export const lineItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPricePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    lineTotalPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    // True when offered in place of what was asked for, which needs customer approval.
    isSubstitute: { type: Boolean, default: false },
    substituteFor: { type: String, trim: true, maxlength: 200 },
  },
  { _id: true },
);

lineItemSchema.pre('validate', function checkLineTotal() {
  if (this.quantity * this.unitPricePaise !== this.lineTotalPaise) {
    this.invalidate('lineTotalPaise', 'Line total must equal quantity multiplied by unit price.');
  }
});

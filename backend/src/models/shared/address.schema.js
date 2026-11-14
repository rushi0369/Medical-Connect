import { Schema } from 'mongoose';

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

const locationSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

const addressFields = {
  fullAddress: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
  area: { type: String, required: true, trim: true, maxlength: 100 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  pincode: { type: String, required: true, match: PINCODE_PATTERN },
  // Set from the map picker in Phase 5.
  location: { type: locationSchema, default: undefined },
  deliveryInstructions: { type: String, trim: true, maxlength: 300 },
};

/** An address saved on a customer's account. */
export const savedAddressSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 50, default: 'Home' },
    isDefault: { type: Boolean, default: false },
    ...addressFields,
  },
  { timestamps: true },
);

/** A copy kept on the order, so later address edits never change past orders. */
export const addressSnapshotSchema = new Schema(addressFields, { _id: false });

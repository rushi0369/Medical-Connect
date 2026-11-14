import mongoose, { Schema } from 'mongoose';
import { SINGLETON_KEY } from '../config/constants.js';
import { addressSnapshotSchema } from './shared/address.schema.js';

// The store's own details. A unique key allows only one record to exist.
const storeSettingsSchema = new Schema(
  {
    key: { type: String, default: SINGLETON_KEY, immutable: true },
    storeName: { type: String, trim: true, maxlength: 120, default: 'CK Medical' },
    contactPhone: { type: String, trim: true, maxlength: 20 },
    upiId: { type: String, trim: true, maxlength: 100 },
    upiQrUrl: { type: String, trim: true, maxlength: 500 },
    // The start point for every road distance. Set on the map in Phase 5.
    address: { type: addressSnapshotSchema },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

storeSettingsSchema.index({ key: 1 }, { unique: true });

export const StoreSettings = mongoose.model('StoreSettings', storeSettingsSchema);

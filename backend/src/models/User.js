import mongoose, { Schema } from 'mongoose';
import { ROLES } from '../config/constants.js';
import { savedAddressSchema } from './shared/address.schema.js';

export const PHONE_PATTERN = /^[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const onlyWhenString = (path) => ({ partialFilterExpression: { [path]: { $type: 'string' } } });

// Customer and rider details live on the user, so one login collection serves all roles.
const riderProfileSchema = new Schema(
  {
    riderId: { type: String, required: true, trim: true },
    vehicleNumber: { type: String, trim: true, uppercase: true, maxlength: 20 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    phone: { type: String, required: true, match: PHONE_PATTERN },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, match: EMAIL_PATTERN },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, immutable: true },
    isActive: { type: Boolean, default: true },
    // Set on accounts given a temporary password, such as new riders.
    mustChangePassword: { type: Boolean, default: false },
    // Raising this number ends every existing login for the account.
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: { type: Date },
    passwordReset: {
      tokenHash: { type: String, select: false },
      otpHash: { type: String, select: false },
      expiresAt: { type: Date, select: false },
    },
    addresses: { type: [savedAddressSchema], default: undefined },
    riderProfile: { type: riderProfileSchema, default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, ...onlyWhenString('email') });
userSchema.index({ 'riderProfile.riderId': 1 }, { unique: true, ...onlyWhenString('riderProfile.riderId') });
userSchema.index({ 'passwordReset.tokenHash': 1 }, onlyWhenString('passwordReset.tokenHash'));
userSchema.index({ role: 1, isActive: 1, createdAt: -1 });

userSchema.pre('validate', function checkRoleDetails() {
  if (this.role === ROLES.RIDER && !this.riderProfile) {
    this.invalidate('riderProfile', 'A rider account needs a rider profile.');
  }
  if (this.role !== ROLES.RIDER && this.riderProfile) {
    this.invalidate('riderProfile', 'Only rider accounts can have a rider profile.');
  }
  if (this.role !== ROLES.CUSTOMER && this.addresses?.length) {
    this.invalidate('addresses', 'Only customer accounts can have saved addresses.');
  }
});

export const User = mongoose.model('User', userSchema);

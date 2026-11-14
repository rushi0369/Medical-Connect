import { ROLES } from '../config/constants.js';

/**
 * The only user fields ever sent to a browser. Listing them explicitly means a new
 * private field added to the model can never leak by accident.
 */
export function serializeUser(user) {
  const shared = {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email ?? null,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
  };

  if (user.role === ROLES.CUSTOMER) {
    return {
      ...shared,
      addresses: (user.addresses ?? []).map((address) => ({
        id: address.id,
        label: address.label,
        isDefault: address.isDefault,
        fullAddress: address.fullAddress,
        area: address.area,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        location: address.location ?? null,
        deliveryInstructions: address.deliveryInstructions ?? null,
      })),
    };
  }

  if (user.role === ROLES.RIDER) {
    return {
      ...shared,
      riderProfile: {
        riderId: user.riderProfile.riderId,
        vehicleNumber: user.riderProfile.vehicleNumber ?? null,
        notes: user.riderProfile.notes ?? null,
      },
    };
  }

  return shared;
}

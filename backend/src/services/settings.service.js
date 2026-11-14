import mongoose from 'mongoose';
import { AUDIT_ACTION } from '../config/constants.js';
import { DeliveryPricing, StoreSettings } from '../models/index.js';
import { recordAudit } from './audit.service.js';

// The example rates from the brief, offered until the admin saves their own.
export const EXAMPLE_TIERS = [
  { minKm: 0, maxKm: 2, chargePaise: 2000 },
  { minKm: 2, maxKm: 5, chargePaise: 3000 },
  { minKm: 5, maxKm: 8, chargePaise: 4000 },
  { minKm: 8, maxKm: 12, chargePaise: 6000 },
  { minKm: 12, maxKm: null, chargePaise: null },
];

const serializeTier = (tier) => ({ minKm: tier.minKm, maxKm: tier.maxKm ?? null, chargePaise: tier.chargePaise ?? null });

export async function getStoreSettings() {
  const settings = await StoreSettings.findOne();
  return {
    isSaved: Boolean(settings),
    storeName: settings?.storeName ?? 'CK Medical',
    contactPhone: settings?.contactPhone ?? null,
    upiId: settings?.upiId ?? null,
    upiQrUrl: settings?.upiQrUrl ?? null,
    address: settings?.address
      ? {
          fullAddress: settings.address.fullAddress,
          area: settings.address.area,
          city: settings.address.city,
          state: settings.address.state,
          pincode: settings.address.pincode,
          location: settings.address.location?.lat != null ? { lat: settings.address.location.lat, lng: settings.address.location.lng } : null,
        }
      : null,
    updatedAt: settings?.updatedAt ?? null,
  };
}

export async function saveStoreSettings(input, admin, req) {
  await mongoose.connection.transaction(async (session) => {
    const update = {
      ...(input.storeName ? { storeName: input.storeName } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
      ...(input.upiId !== undefined ? { upiId: input.upiId } : {}),
      ...(input.upiQrUrl !== undefined ? { upiQrUrl: input.upiQrUrl } : {}),
      ...(input.address ? { address: input.address } : {}),
      updatedBy: admin._id,
    };
    await StoreSettings.findOneAndUpdate(
      {},
      { $set: update },
      { upsert: true, runValidators: true, session },
    );
    await recordAudit({ actor: admin, action: AUDIT_ACTION.STORE_SETTINGS_UPDATED, entityType: 'StoreSettings', req, session });
  });
  return getStoreSettings();
}

export async function getDeliveryPricing() {
  const pricing = await DeliveryPricing.findOne();
  return {
    isSaved: Boolean(pricing?.tiers.length),
    tiers: pricing?.tiers.length ? pricing.tiers.map(serializeTier) : EXAMPLE_TIERS,
    updatedAt: pricing?.updatedAt ?? null,
  };
}

export async function saveDeliveryPricing({ tiers }, admin, req) {
  await mongoose.connection.transaction(async (session) => {
    const pricing = (await DeliveryPricing.findOne().session(session)) ?? new DeliveryPricing();
    pricing.tiers = tiers.map((tier) => ({ minKm: tier.minKm, maxKm: tier.maxKm ?? undefined, chargePaise: tier.chargePaise ?? undefined }));
    pricing.updatedBy = admin._id;
    await pricing.save({ session });
    await recordAudit({
      actor: admin,
      action: AUDIT_ACTION.DELIVERY_PRICING_UPDATED,
      entityType: 'DeliveryPricing',
      metadata: { tiers: pricing.tiers.map(serializeTier) },
      req,
      session,
    });
  });
  return getDeliveryPricing();
}

/**
 * Picks the charge for a road distance. Returns null when the matching tier leaves
 * the charge to the admin, as with "above 12 km".
 */
export function chargeForDistance(tiers, distanceKm) {
  const tier = tiers.find(
    (candidate, index) =>
      (index === 0 ? distanceKm >= candidate.minKm : distanceKm > candidate.minKm) &&
      (candidate.maxKm == null || distanceKm <= candidate.maxKm),
  );
  return { chargePaise: tier?.chargePaise ?? null, tier: tier ? serializeTier(tier) : null };
}

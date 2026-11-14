import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const CACHE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

// The same store and customer pin give the same road route, so answers are reused
// for a day. This keeps the Routes API bill down.
const cache = new Map();

export const isRoutingConfigured = () => Boolean(env.GOOGLE_MAPS_SERVER_API_KEY);

const round = (value) => Number(value).toFixed(5);
const cacheKey = (origin, destination) => [origin.lat, origin.lng, destination.lat, destination.lng].map(round).join(',');

export function clearRouteCache() {
  cache.clear();
}

/**
 * Real road distance and travel time from Google's Routes API. Straight-line distance
 * is never used for pricing. On failure the admin can still enter the charge by hand.
 */
export async function getRoadRoute(origin, destination) {
  if (!isRoutingConfigured()) {
    throw new AppError(503, 'MAPS_NOT_CONFIGURED', 'Road distance is not available until a Google Maps key is added. Enter the delivery charge by hand.');
  }

  const key = cacheKey(origin, destination);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, isCached: true };

  let response;
  try {
    response = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_MAPS_SERVER_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: 'TWO_WHEELER',
        units: 'METRIC',
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error(`Routes API request failed: ${error.message}`);
    throw new AppError(502, 'ROUTE_UNAVAILABLE', 'Could not reach Google Maps to work out the road distance. Try again or enter the charge by hand.');
  }

  const data = await response.json().catch(() => ({}));
  const route = data.routes?.[0];
  if (!response.ok || !route?.distanceMeters) {
    console.error(`Routes API answered ${response.status}: ${data.error?.message ?? 'no route found'}`);
    throw new AppError(502, 'ROUTE_UNAVAILABLE', 'Google Maps could not find a road route to this address. Enter the charge by hand.');
  }

  const value = {
    distanceKm: Math.round(route.distanceMeters / 100) / 10,
    durationMinutes: Math.max(1, Math.round(Number.parseInt(route.duration ?? '0', 10) / 60)),
  };

  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_LIFETIME_MS });
  return { ...value, isCached: false };
}

/**
 * Fallback estimation using road curvature factor when Google Maps key is not configured.
 */
export function estimateRoute(origin, destination) {
  const R = 6371;
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  const distanceKm = Math.max(0.5, Math.round(straightKm * 1.35 * 10) / 10);
  const durationMinutes = Math.max(5, Math.round(distanceKm * 3.5));
  return { distanceKm, durationMinutes, isEstimated: true };
}

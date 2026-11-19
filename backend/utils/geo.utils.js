/**
 * geo.utils.js
 *
 * Geographical coordinate validation, Haversine distance, GeoJSON helpers,
 * and coarse distance band formatting for user privacy.
 */

/**
 * Validates GeoJSON coordinate array [longitude, latitude].
 *
 * @param {Array<number>} coordinates - [longitude, latitude]
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validateGeoCoordinates = (coordinates) => {
  if (!coordinates || !Array.isArray(coordinates)) {
    return { isValid: false, error: "Coordinates must be an array of [longitude, latitude]" };
  }

  if (coordinates.length !== 2) {
    return { isValid: false, error: "Coordinates array must contain exactly 2 numbers: [longitude, latitude]" };
  }

  const [lng, lat] = coordinates;

  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return { isValid: false, error: "Coordinates must be finite numeric values" };
  }

  if (lng < -180 || lng > 180) {
    return { isValid: false, error: "Longitude must be between -180 and 180 degrees" };
  }

  if (lat < -90 || lat > 90) {
    return { isValid: false, error: "Latitude must be between -90 and 90 degrees" };
  }

  return { isValid: true };
};

/**
 * Pure JS Haversine formula for spherical distance between two lat/lng points.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in kilometres
 */
export const haversineDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Wraps a longitude/latitude pair into a GeoJSON Point object.
 *
 * @param {number} longitude
 * @param {number} latitude
 * @returns {{ type: "Point", coordinates: [number, number] }}
 */
export const coordinatesToGeoJSON = (longitude, latitude) => ({
  type: "Point",
  coordinates: [longitude, latitude],
});

/**
 * Maps exact distance into coarse privacy-safe bands.
 * Never exposes exact meters or coordinates to searching players.
 *
 * @param {number} distanceMeters
 * @returns {string} Coarse band, e.g. "< 1 km", "1-3 km", "3-5 km", etc.
 */
export const formatCoarseDistanceBand = (distanceMeters) => {
  if (distanceMeters === null || distanceMeters === undefined) return "Nearby";
  const km = distanceMeters / 1000;

  if (km <= 1) return "< 1 km";
  if (km <= 3) return "1–3 km";
  if (km <= 5) return "3–5 km";
  if (km <= 10) return "5–10 km";
  if (km <= 20) return "10–20 km";
  return "> 20 km";
};

import * as h3 from "h3-js";
import { H3_CONFIG } from "../config/h3.config.js";

// ─── Existing exports (kept intact) ───────────────────────────────────────────

/**
 * Calculates Uber H3 cell index from GeoJSON coordinates [longitude, latitude].
 *
 * @param {Array<number>} coordinates - [longitude, latitude]
 * @param {number} [resolution] - H3 resolution (0-15)
 * @returns {string|null} - Hexadecimal H3 index
 */
export const calculateH3Index = (coordinates, resolution = H3_CONFIG.fineResolution) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [lng, lat] = coordinates;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(
      "Invalid GPS coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180."
    );
  }

  const res = Math.min(Math.max(resolution, 0), 15);
  return h3.latLngToCell(lat, lng, res);
};

/**
 * Validates whether an H3 cell string is valid.
 *
 * @param {string} h3Index
 * @returns {boolean}
 */
export const isValidH3Index = (h3Index) => {
  if (!h3Index || typeof h3Index !== "string") return false;
  return h3.isValidCell(h3Index);
};

/**
 * Gets neighboring cells (k-ring disk) for radius searches.
 *
 * @param {string} h3Index
 * @param {number} [ringRadius=1]
 * @returns {string[]}
 */
export const getNearbyCells = (h3Index, ringRadius = 1) => {
  if (!isValidH3Index(h3Index)) return [];
  return h3.gridDisk(h3Index, ringRadius);
};

// ─── Dual-Resolution & Geospatial Covering Helpers ─────────────────────────────

/**
 * Computes H3 cell indices at both resolutions 7 and 8 independently for a coordinate pair.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {{ res7: string, res8: string }}
 */
export const calculateH3Cells = (latitude, longitude) => {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("Latitude and longitude must be numbers");
  }
  const res7 = h3.latLngToCell(latitude, longitude, H3_CONFIG.coarseResolution);
  const res8 = h3.latLngToCell(latitude, longitude, H3_CONFIG.fineResolution);
  return { res7, res8 };
};

/**
 * Selects the appropriate H3 resolution based on search radius.
 * Fine resolution (8) for ≤3 km, coarse (7) for larger radii.
 *
 * @param {number} radiusKm
 * @returns {number} 7 or 8
 */
export const selectH3Resolution = (radiusKm) => {
  return radiusKm <= H3_CONFIG.fineSearchMaxRadiusKm
    ? H3_CONFIG.fineResolution
    : H3_CONFIG.coarseResolution;
};

/**
 * Returns the set of H3 cells that conservatively cover a circular search area.
 * Uses polygonToCells for precision; falls back to gridDisk conservatively.
 * Handles Edge Case 68 (Excessive Candidate Cells): if candidate cells exceed budget,
 * signals fallback to pure MongoDB $geoNear instead of truncating candidate cells.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} radiusKm
 * @param {number} resolution - 7 or 8
 * @returns {{ cells: string[], usedFallback: boolean, reason?: string }}
 */
export const getSearchCoveringCells = (latitude, longitude, radiusKm, resolution) => {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.cos((latitude * Math.PI) / 180);
  const lngDelta = radiusKm / (111.32 * (Math.abs(cosLat) < 0.01 ? 0.01 : cosLat));

  // Build a circular polygon approximation (24 points) for conservative polygonToCells
  const steps = 24;
  const polygonCoords = [];
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const pointLat = Math.max(-90, Math.min(90, latitude + latDelta * Math.sin(angle)));
    let pointLng = longitude + lngDelta * Math.cos(angle);
    // Normalize longitude wrapping [-180, 180]
    if (pointLng > 180) pointLng -= 360;
    if (pointLng < -180) pointLng += 360;
    // h3-js expects [lat, lng]
    polygonCoords.push([pointLat, pointLng]);
  }
  // Close the polygon ring
  polygonCoords.push(polygonCoords[0]);

  let cells = [];
  let usedFallback = false;
  let reason = null;

  try {
    // h3-js v4: polygonToCells(polygonCoordinates, resolution)
    cells = h3.polygonToCells(polygonCoords, resolution);
  } catch (polyErr) {
    // Edge Case: Fallback to gridDisk if polygonToCells encounters polar or boundary edge cases
    try {
      const centerCell = h3.latLngToCell(latitude, longitude, resolution);
      const edgeLengthKm = resolution === 8 ? 0.461 : 1.22;
      const ringK = Math.ceil(radiusKm / edgeLengthKm) + 1;
      cells = h3.gridDisk(centerCell, ringK);
      usedFallback = true;
      reason = "polygon_failure_disk_fallback";
    } catch (diskErr) {
      return { cells: [], usedFallback: true, reason: "h3_failure_geo_fallback" };
    }
  }

  // Deduplicate cells
  cells = Array.from(new Set(cells));

  // Edge Case 68: Excessive Candidate Cells
  // If count exceeds budget, DO NOT TRUNCATE. Instead, trigger full MongoDB $geoNear fallback
  if (cells.length > H3_CONFIG.maxCandidateCells) {
    return {
      cells: [],
      usedFallback: true,
      reason: `candidate_budget_exceeded_${cells.length}_max_${H3_CONFIG.maxCandidateCells}`,
    };
  }

  return { cells, usedFallback, reason };
};

/**
 * Validates a GeoJSON coordinate pair [longitude, latitude].
 *
 * @param {any} coordinates - Expected [lng, lat]
 * @returns {{ isValid: boolean, error: string|null }}
 */
export const validateGeoCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return { isValid: false, error: "Coordinates must be an array of [longitude, latitude]" };
  }
  const [lng, lat] = coordinates;
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return { isValid: false, error: "Longitude and latitude must be finite numbers" };
  }
  if (lng < -180 || lng > 180) {
    return { isValid: false, error: "Longitude must be between -180 and 180" };
  }
  if (lat < -90 || lat > 90) {
    return { isValid: false, error: "Latitude must be between -90 and 90" };
  }
  return { isValid: true, error: null };
};

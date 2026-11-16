import * as h3 from "h3-js";
import { H3_CONFIG } from "../config/h3.config.js";

/**
 * Calculates Uber H3 cell index from GeoJSON coordinates [longitude, latitude].
 *
 * @param {Array<number>} coordinates - [longitude, latitude]
 * @param {number} [resolution] - H3 resolution (0-15)
 * @returns {string|null} - Hexadecimal H3 index
 */
export const calculateH3Index = (coordinates, resolution = H3_CONFIG.DEFAULT_RESOLUTION) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [lng, lat] = coordinates;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("Invalid GPS coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.");
  }

  const res = Math.min(Math.max(resolution, H3_CONFIG.MIN_RESOLUTION), H3_CONFIG.MAX_RESOLUTION);
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

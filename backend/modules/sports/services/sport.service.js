import { Sport } from "../models/sport.model.js";

/**
 * Sports Catalogue Service
 */

/**
 * Retrieves all sports from the authoritative catalogue
 *
 * @param {boolean} [activeOnly=true]
 * @returns {Promise<Sport[]>}
 */
export const getAllSports = async (activeOnly = true) => {
  const query = activeOnly ? { isActive: true } : {};
  return await Sport.find(query).select("name slug hasPositions positions isActive").sort({ name: 1 });
};

/**
 * Retrieves a single sport by its unique slug
 *
 * @param {string} slug
 * @returns {Promise<Sport>}
 */
export const getSportBySlug = async (slug) => {
  if (!slug) {
    const err = new Error("Sport slug is required");
    err.statusCode = 400;
    throw err;
  }

  const normalized = String(slug).toLowerCase().trim();
  const sport = await Sport.findOne({ slug: normalized, isActive: true }).select(
    "name slug hasPositions positions isActive"
  );

  if (!sport) {
    const err = new Error(`Sport '${slug}' not found in catalogue`);
    err.statusCode = 404;
    throw err;
  }

  return sport;
};

import { formatCoarseDistanceBand } from "../../../utils/geo.utils.js";

/**
 * Calculates a composite match score for ranking discovery candidates.
 * Formula from Section 27:
 * score = 0.7 * normalizedProximityScore + 0.3 * normalizedExperienceScore
 *
 * @param {number} distanceMeters
 * @param {number} maxDistanceMeters
 * @param {number} experienceLevel (1-10)
 * @returns {number} Score between 0.0 and 1.0
 */
export const calculateDiscoveryScore = (distanceMeters, maxDistanceMeters, experienceLevel = 5) => {
  const normalizedProximity = Math.max(0, 1 - distanceMeters / maxDistanceMeters);
  const normalizedExperience = Math.min(10, Math.max(1, experienceLevel)) / 10;

  return 0.7 * normalizedProximity + 0.3 * normalizedExperience;
};

export { formatCoarseDistanceBand };

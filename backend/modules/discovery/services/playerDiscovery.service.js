import { UserProfile } from "../../user/models/userProfile.model.js";
import { Sport } from "../../sports/models/sport.model.js";
import { EXPERIENCE_RATING } from "../../../config/sports.config.js";
import { selectH3Resolution, getSearchCoveringCells } from "../../../utils/h3.utils.js";
import { formatCoarseDistanceBand } from "../../../utils/geo.utils.js";
import { buildPlayerDiscoveryPipeline } from "../pipelines/playerDiscovery.pipeline.js";
import { getEffectiveAvailability } from "../../availability/utils/availabilityCalculator.js";

/**
 * Searches for nearby players matching sport, position, and optional filters.
 * Implements 6 mandatory H3 edge cases including empty hexagon expansion and excessive cell fallback.
 *
 * @param {string} requestingUserId
 * @param {Object} params
 */
export const searchPlayers = async (requestingUserId, params) => {
  const {
    sport: sportSlug,
    position = "any",
    searchLocation,
    filters = {},
    autoExpandRadius = false,
    page = 1,
    limit = 20,
  } = params;

  // 1. Resolve Sport
  const sportDoc = await Sport.findOne({ slug: sportSlug.toLowerCase().trim(), isActive: true });
  if (!sportDoc) {
    const err = new Error(`Sport '${sportSlug}' is not found in authoritative catalogue`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Validate position against sport catalogue
  if (position && position !== "any" && position !== "not_sure") {
    if (!sportDoc.hasPositions) {
      const err = new Error(`Sport '${sportDoc.name}' does not support positions`);
      err.statusCode = 400;
      throw err;
    }
    const validPositions = sportDoc.positions.map((p) => p.value);
    if (!validPositions.includes(position.toLowerCase())) {
      const err = new Error(`Invalid position '${position}' for ${sportDoc.name}. Valid: ${validPositions.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
  }

  const [lng, lat] = searchLocation.coordinates;
  let currentRadiusKm = filters.maxDistanceKm || 10;
  const EXPANSION_STEPS = [5, 10, 15, 20];

  let players = [];
  let executionMeta = {};

  // Search iteration (supports Edge Case 66 progressive radius expansion if enabled)
  while (true) {
    const resolution = selectH3Resolution(currentRadiusKm);
    const h3Field = resolution === 8 ? "h3Cells.res8" : "h3Cells.res7";

    // Compute covering cells
    const { cells, usedFallback, reason } = getSearchCoveringCells(lat, lng, currentRadiusKm, resolution);

    const radiusMeters = currentRadiusKm * 1000;
    const skip = (page - 1) * limit;

    const pipeline = buildPlayerDiscoveryPipeline({
      searchLocation,
      radiusMeters,
      useH3Filter: !usedFallback && cells.length > 0,
      h3Field,
      candidateCells: cells,
      requestingUserId,
      sportDoc,
      position,
      filters,
      skip,
      limit,
    });

    const candidates = await UserProfile.aggregate(pipeline);

    executionMeta = {
      searchRadiusKm: currentRadiusKm,
      selectedResolution: resolution,
      coveringCellCount: cells.length,
      usedGeoFallback: usedFallback,
      fallbackReason: reason || null,
    };

    if (candidates.length > 0 || !autoExpandRadius) {
      players = candidates;
      break;
    }

    // Edge Case 66: Auto radius expansion when 0 candidates found in immediate area
    const nextStep = EXPANSION_STEPS.find((r) => r > currentRadiusKm);
    if (!nextStep || nextStep > 20) {
      players = [];
      break;
    }
    currentRadiusKm = nextStep;
  }

  // 3. Re-evaluate real-time effective availability for each candidate (Section 74)
  const results = players.map((p) => {
    const effective = getEffectiveAvailability(p, new Date());
    return {
      userId: p.userId,
      username: p.username,
      playerCode: p.playerCode,
      displayName: p.displayName,
      avatar: p.avatar,
      sport: p.sport,
      sportSlug: p.sportSlug,
      preferredPositions: p.preferredPositions,
      experienceLevel: p.experienceLevel,
      experienceCategory: EXPERIENCE_RATING.getCategory(p.experienceLevel),
      isPrimarySport: p.isPrimarySport,
      distanceBand: formatCoarseDistanceBand(p.distanceMeters),
      city: p.city,
      isAvailable: effective.isAvailable,
      availabilityStatus: effective.effectiveStatus,
      discoveryScore: p.discoveryScore ? Math.round(p.discoveryScore * 100) / 100 : null,
    };
  });

  return {
    results,
    count: results.length,
    page,
    limit,
    meta: executionMeta,
  };
};

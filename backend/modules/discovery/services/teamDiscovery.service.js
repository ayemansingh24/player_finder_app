import { Team } from "../../teams/models/team.model.js";
import { Sport } from "../../sports/models/sport.model.js";
import { selectH3Resolution, getSearchCoveringCells } from "../../../utils/h3.utils.js";
import { formatCoarseDistanceBand } from "../../../utils/geo.utils.js";
import { buildTeamDiscoveryPipeline } from "../pipelines/teamDiscovery.pipeline.js";

/**
 * Searches for nearby opponent teams accepting challenges.
 *
 * @param {string} requestingCaptainId
 * @param {Object} params
 */
export const searchTeams = async (requestingCaptainId, params) => {
  const { sport: sportSlug, matchFormat, searchLocation, maxDistanceKm = 10, page = 1, limit = 20 } = params;

  const sportDoc = await Sport.findOne({ slug: sportSlug.toLowerCase().trim(), isActive: true });
  if (!sportDoc) {
    const err = new Error(`Sport '${sportSlug}' is not found in authoritative catalogue`);
    err.statusCode = 404;
    throw err;
  }

  const [lng, lat] = searchLocation.coordinates;
  const resolution = selectH3Resolution(maxDistanceKm);
  const h3Field = resolution === 8 ? "h3Cells.res8" : "h3Cells.res7";

  const { cells, usedFallback, reason } = getSearchCoveringCells(lat, lng, maxDistanceKm, resolution);

  const radiusMeters = maxDistanceKm * 1000;
  const skip = (page - 1) * limit;

  const pipeline = buildTeamDiscoveryPipeline({
    searchLocation,
    radiusMeters,
    useH3Filter: !usedFallback && cells.length > 0,
    h3Field,
    candidateCells: cells,
    sportDoc,
    matchFormat,
    requestingCaptainId,
    skip,
    limit,
  });

  const rawTeams = await Team.aggregate(pipeline);

  const results = rawTeams.map((t) => ({
    teamId: t._id,
    name: t.name,
    sport: t.sport,
    sportSlug: t.sportSlug,
    type: t.type,
    logo: t.logo,
    description: t.description,
    matchFormats: t.matchFormats,
    distanceBand: formatCoarseDistanceBand(t.distanceMeters),
    preferredPlayingLocation: t.preferredPlayingLocation,
    captain: t.captain,
  }));

  return {
    results,
    count: results.length,
    page,
    limit,
    meta: {
      searchRadiusKm: maxDistanceKm,
      selectedResolution: resolution,
      coveringCellCount: cells.length,
      usedGeoFallback: usedFallback,
      fallbackReason: reason || null,
    },
  };
};

import mongoose from "mongoose";

/**
 * Builds aggregation pipeline for discovering nearby opponent teams.
 *
 * @param {Object} params
 * @param {Object} params.searchLocation - GeoJSON Point { type: "Point", coordinates: [lng, lat] }
 * @param {number} params.radiusMeters
 * @param {boolean} params.useH3Filter
 * @param {string} params.h3Field
 * @param {Array<string>} params.candidateCells
 * @param {Object} params.sportDoc
 * @param {string} [params.matchFormat]
 * @param {string} [params.requestingCaptainId]
 * @param {number} params.skip
 * @param {number} params.limit
 */
export const buildTeamDiscoveryPipeline = ({
  searchLocation,
  radiusMeters,
  useH3Filter = false,
  h3Field = "h3Cells.res7",
  candidateCells = [],
  sportDoc,
  matchFormat,
  requestingCaptainId,
  skip = 0,
  limit = 20,
}) => {
  const pipeline = [];

  // Stage 1: $geoNear
  const geoQuery = {
    status: "active",
    challengeEnabled: true,
    sport: new mongoose.Types.ObjectId(sportDoc._id),
  };

  if (requestingCaptainId) {
    geoQuery.captain = { $ne: new mongoose.Types.ObjectId(requestingCaptainId) };
  }

  if (useH3Filter && Array.isArray(candidateCells) && candidateCells.length > 0) {
    geoQuery[h3Field] = { $in: candidateCells };
  }

  pipeline.push({
    $geoNear: {
      near: searchLocation,
      key: "preferredPlayingLocation.geo",
      distanceField: "distanceMeters",
      spherical: true,
      maxDistance: radiusMeters,
      query: geoQuery,
    },
  });

  // Stage 2: Match format filter
  if (matchFormat) {
    pipeline.push({
      $match: {
        matchFormats: matchFormat,
      },
    });
  }

  // Stage 3: Lookup Captain Details
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "captain",
      foreignField: "_id",
      as: "captainDetails",
    },
  });
  pipeline.push({ $unwind: "$captainDetails" });

  // Stage 4: Sort nearest first
  pipeline.push({
    $sort: {
      distanceMeters: 1,
      _id: 1,
    },
  });

  // Stage 5: Pagination
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // Stage 6: Privacy Safe Projection
  pipeline.push({
    $project: {
      _id: 1,
      name: "$name",
      sport: sportDoc.name,
      sportSlug: sportDoc.slug,
      type: "$type",
      logo: "$logo",
      description: "$description",
      matchFormats: "$matchFormats",
      distanceMeters: "$distanceMeters",
      preferredPlayingLocation: {
        venueName: "$preferredPlayingLocation.venueName",
        city: "$preferredPlayingLocation.city",
        state: "$preferredPlayingLocation.state",
      },
      captain: {
        userId: "$captainDetails._id",
        username: "$captainDetails.username",
        playerCode: "$captainDetails.playerCode",
        displayName: "$captainDetails.fullName",
      },
    },
  });

  return pipeline;
};

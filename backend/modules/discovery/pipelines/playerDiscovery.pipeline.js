import mongoose from "mongoose";

/**
 * Builds the comprehensive 10-stage MongoDB aggregation pipeline for Player Discovery.
 * Follows all requirements from Section 27 and Edge Cases from Part I.
 *
 * @param {Object} params
 * @param {Object} params.searchLocation - GeoJSON Point { type: "Point", coordinates: [lng, lat] }
 * @param {number} params.radiusMeters - Search radius in meters
 * @param {boolean} params.useH3Filter - Whether to filter by H3 covering cells
 * @param {string} params.h3Field - 'h3Cells.res7' or 'h3Cells.res8'
 * @param {Array<string>} params.candidateCells - Array of H3 cell IDs
 * @param {string} params.requestingUserId - Auth user ID of the searching captain (to exclude)
 * @param {Object} params.sportDoc - Authoritative Sport document
 * @param {string} [params.position] - Optional position slug or 'any'
 * @param {Object} params.filters - Optional filters { minExperience, ageMin, ageMax, gender }
 * @param {number} params.skip - Pagination skip
 * @param {number} params.limit - Pagination limit
 */
export const buildPlayerDiscoveryPipeline = ({
  searchLocation,
  radiusMeters,
  useH3Filter = false,
  h3Field = "h3Cells.res7",
  candidateCells = [],
  requestingUserId,
  sportDoc,
  position = "any",
  filters = {},
  skip = 0,
  limit = 20,
}) => {
  const pipeline = [];

  // -------------------------------------------------------------
  // Stage 1: $geoNear (MUST be the first stage in pipeline)
  // -------------------------------------------------------------
  const geoNearQuery = {
    "location.isSharingEnabled": true,
  };

  // If H3 candidate cells are provided and within budget, apply H3 cell restriction
  if (useH3Filter && Array.isArray(candidateCells) && candidateCells.length > 0) {
    geoNearQuery[h3Field] = { $in: candidateCells };
  }

  pipeline.push({
    $geoNear: {
      near: searchLocation,
      key: "location.geo",
      distanceField: "distanceMeters",
      spherical: true,
      maxDistance: radiusMeters,
      query: geoNearQuery,
    },
  });

  // -------------------------------------------------------------
  // Stage 2: Profile Eligibility $match
  // -------------------------------------------------------------
  const profileMatch = {
    onboardingCompleted: true,
    "location.isSharingEnabled": true,
  };

  // Exclude searching user
  if (requestingUserId) {
    profileMatch.authUser = { $ne: new mongoose.Types.ObjectId(requestingUserId) };
  }

  // Gender filter (voluntary)
  if (filters.gender && filters.gender !== "any") {
    profileMatch.gender = filters.gender;
  }

  // Age filters (calculated dynamically from dateOfBirth)
  const ageConditions = [];
  const MS_PER_YEAR = 31557600000; // 365.25 days * 24 * 3600 * 1000

  if (filters.ageMin) {
    ageConditions.push({
      $gte: [
        { $divide: [{ $subtract: ["$$NOW", "$dateOfBirth"] }, MS_PER_YEAR] },
        filters.ageMin,
      ],
    });
  }

  if (filters.ageMax) {
    ageConditions.push({
      $lte: [
        { $divide: [{ $subtract: ["$$NOW", "$dateOfBirth"] }, MS_PER_YEAR] },
        filters.ageMax,
      ],
    });
  }

  if (ageConditions.length > 0) {
    profileMatch.$expr = {
      $and: [
        { $ne: ["$dateOfBirth", null] },
        ...ageConditions,
      ],
    };
  }

  pipeline.push({ $match: profileMatch });

  // -------------------------------------------------------------
  // Stage 3: Account Eligibility Lookup (Join User account)
  // -------------------------------------------------------------
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "authUser",
        foreignField: "_id",
        as: "account",
      },
    },
    { $unwind: "$account" }
  );

  // -------------------------------------------------------------
  // Stage 4: UserSport Lookup (Registered sports)
  // -------------------------------------------------------------
  pipeline.push(
    {
      $lookup: {
        from: "usersports",
        localField: "authUser",
        foreignField: "authUser",
        as: "sportProfile",
      },
    },
    { $unwind: "$sportProfile" }
  );

  // -------------------------------------------------------------
  // Stage 5: Matching Sport & Position & Experience $match
  // -------------------------------------------------------------
  const sportMatch = {
    "sportProfile.sport": new mongoose.Types.ObjectId(sportDoc._id),
  };

  // Position handling
  if (position && position !== "any") {
    if (position === "not_sure") {
      sportMatch["sportProfile.preferredPositions"] = "not_sure";
    } else {
      // Must contain this specific playing position (not_sure does not qualify)
      sportMatch["sportProfile.preferredPositions"] = position;
    }
  }

  // Experience level filter
  if (filters.minExperience) {
    sportMatch["sportProfile.experienceLevel"] = { $gte: filters.minExperience };
  }

  pipeline.push({ $match: sportMatch });

  // -------------------------------------------------------------
  // Stage 6: Ranking Score Calculation ($addFields)
  // score = 0.7 * proximityScore + 0.3 * experienceScore
  // -------------------------------------------------------------
  pipeline.push({
    $addFields: {
      discoveryScore: {
        $add: [
          {
            $multiply: [
              0.7,
              {
                $max: [
                  0,
                  {
                    $subtract: [
                      1,
                      { $divide: ["$distanceMeters", Math.max(1, radiusMeters)] },
                    ],
                  },
                ],
              },
            ],
          },
          {
            $multiply: [
              0.3,
              { $divide: ["$sportProfile.experienceLevel", 10] },
            ],
          },
        ],
      },
    },
  });

  // -------------------------------------------------------------
  // Stage 7: Sorting (Relevance or nearest first)
  // -------------------------------------------------------------
  pipeline.push({
    $sort: {
      discoveryScore: -1,
      distanceMeters: 1,
      _id: 1,
    },
  });

  // -------------------------------------------------------------
  // Stage 8: Pagination ($skip, $limit)
  // -------------------------------------------------------------
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // -------------------------------------------------------------
  // Stage 9: Privacy-Safe $project (Section 27)
  // Never expose: passwords, emails, refreshTokens, OTPs, exact coordinates,
  // fine H3 identifiers, or full date of birth.
  // -------------------------------------------------------------
  pipeline.push({
    $project: {
      _id: 1,
      userId: "$authUser",
      username: "$account.username",
      playerCode: "$account.playerCode",
      displayName: "$displayName",
      avatar: {
        url: { $ifNull: ["$avatar.url", "default-avatar"] },
      },
      sport: sportDoc.name,
      sportSlug: sportDoc.slug,
      preferredPositions: "$sportProfile.preferredPositions",
      experienceLevel: "$sportProfile.experienceLevel",
      isPrimarySport: "$sportProfile.isPrimarySport",
      distanceMeters: "$distanceMeters",
      locality: { $ifNull: ["$location.city", ""] },
      city: { $ifNull: ["$location.city", ""] },
      availability: "$availability",
      discoveryScore: "$discoveryScore",
    },
  });

  return pipeline;
};

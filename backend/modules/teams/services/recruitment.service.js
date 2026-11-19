import { TeamRecruitmentRequest } from "../models/teamRecruitmentRequest.model.js";
import { Team } from "../models/team.model.js";
import { calculateH3Cells } from "../../../utils/h3.utils.js";

/**
 * Creates an explicit recruitment request for a team.
 *
 * @param {string} teamId
 * @param {string} captainId
 * @param {Object} data
 */
export const createRecruitment = async (teamId, captainId, data) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const err = new Error("Team not found");
    err.statusCode = 404;
    throw err;
  }

  if (team.captain.toString() !== captainId.toString()) {
    const err = new Error("Only the team captain can post recruitment requests");
    err.statusCode = 403;
    throw err;
  }

  const coords = data.playingLocation?.coordinates || team.preferredPlayingLocation?.geo?.coordinates;
  let h3 = { res7: null, res8: null };
  if (coords && Array.isArray(coords) && coords.length === 2) {
    h3 = calculateH3Cells(coords[1], coords[0]);
  }

  const recruitment = await TeamRecruitmentRequest.create({
    team: teamId,
    captain: captainId,
    sport: team.sport,
    preferredPositions: data.preferredPositions || [],
    requiredPlayerCount: data.requiredPlayerCount,
    acceptedPlayerCount: 0,
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    durationMinutes: data.durationMinutes || 60,
    playingLocation: {
      geo: {
        type: "Point",
        coordinates: coords,
      },
      venue: data.playingLocation?.venue || team.preferredPlayingLocation?.venueName || "",
      city: data.playingLocation?.city || team.preferredPlayingLocation?.city || "",
    },
    h3Cells: h3,
    status: "open",
  });

  return recruitment;
};

/**
 * Retrieves recruitment requests for a team.
 *
 * @param {string} teamId
 */
export const getTeamRecruitments = async (teamId) => {
  return await TeamRecruitmentRequest.find({ team: teamId })
    .populate("sport", "name slug")
    .sort({ createdAt: -1 });
};

/**
 * Updates a recruitment request.
 *
 * @param {string} requestId
 * @param {string} captainId
 * @param {Object} updates
 */
export const updateRecruitment = async (requestId, captainId, updates) => {
  const reqDoc = await TeamRecruitmentRequest.findById(requestId);
  if (!reqDoc) {
    const err = new Error("Recruitment request not found");
    err.statusCode = 404;
    throw err;
  }

  if (reqDoc.captain.toString() !== captainId.toString()) {
    const err = new Error("Only the team captain can modify this recruitment request");
    err.statusCode = 403;
    throw err;
  }

  if (updates.status) reqDoc.status = updates.status;
  if (updates.requiredPlayerCount) reqDoc.requiredPlayerCount = updates.requiredPlayerCount;
  if (updates.preferredPositions) reqDoc.preferredPositions = updates.preferredPositions;

  await reqDoc.save();
  return reqDoc;
};

/**
 * Atomically increments accepted player count for a recruitment request.
 * If filled, transitions status to 'filled'.
 *
 * @param {string} requestId
 */
export const recordRecruitmentAcceptance = async (requestId) => {
  const reqDoc = await TeamRecruitmentRequest.findById(requestId);
  if (!reqDoc || reqDoc.status !== "open") {
    return { success: false, reason: "Recruitment request is no longer open" };
  }

  reqDoc.acceptedPlayerCount += 1;
  if (reqDoc.acceptedPlayerCount >= reqDoc.requiredPlayerCount) {
    reqDoc.status = "filled";
  }

  await reqDoc.save();
  return { success: true, request: reqDoc };
};

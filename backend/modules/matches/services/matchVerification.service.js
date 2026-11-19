import { Match } from "../models/match.model.js";
import { emitToRoom } from "../../../socket/index.js";

/**
 * Captain confirms the final match result.
 * Completes match when both captains independently confirm the matching result version (Section 57).
 *
 * @param {string} matchId
 * @param {string} captainId
 */
export const confirmResult = async (matchId, captainId) => {
  const match = await Match.findById(matchId).populate("teamA teamB");
  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  if (match.status !== "pending_verification") {
    const err = new Error(`Match is not awaiting verification (current status: ${match.status})`);
    err.statusCode = 400;
    throw err;
  }

  const isCaptainA = match.teamA?.captain?.toString() === captainId.toString();
  const isCaptainB = match.teamB?.captain?.toString() === captainId.toString();

  if (!isCaptainA && !isCaptainB) {
    const err = new Error("Only the captains of the competing teams can confirm match results");
    err.statusCode = 403;
    throw err;
  }

  if (isCaptainA) {
    match.verificationData.teamAConfirmed = true;
    match.verificationData.teamAConfirmedAt = new Date();
  }
  if (isCaptainB) {
    match.verificationData.teamBConfirmed = true;
    match.verificationData.teamBConfirmedAt = new Date();
  }

  let isFullyCompleted = false;

  // Complete match if both captains confirmed, or if it's an individual match with teamA only
  if (
    (match.verificationData.teamAConfirmed && match.verificationData.teamBConfirmed) ||
    (match.verificationData.teamAConfirmed && !match.teamB)
  ) {
    match.status = "completed";
    isFullyCompleted = true;
  }

  await match.save();

  emitToRoom(`match:${matchId}`, isFullyCompleted ? "match:completed" : "match:partially_confirmed", {
    matchId,
    status: match.status,
    verificationData: match.verificationData,
    verifiedResult: match.verifiedResult,
  });

  return {
    confirmed: true,
    isCompleted: isFullyCompleted,
    status: match.status,
    verificationData: match.verificationData,
  };
};

/**
 * Flags match result as disputed by either captain.
 *
 * @param {string} matchId
 * @param {string} captainId
 * @param {string} reason
 */
export const disputeResult = async (matchId, captainId, reason) => {
  const match = await Match.findById(matchId).populate("teamA teamB");
  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  const isCaptainA = match.teamA?.captain?.toString() === captainId.toString();
  const isCaptainB = match.teamB?.captain?.toString() === captainId.toString();

  if (!isCaptainA && !isCaptainB) {
    const err = new Error("Only competing captains can dispute match results");
    err.statusCode = 403;
    throw err;
  }

  match.status = "disputed";
  match.disputeData = {
    disputedBy: captainId,
    reason: reason || "Result disputed by captain",
    disputedAt: new Date(),
    resolvedBy: null,
    resolution: null,
  };

  await match.save();

  emitToRoom(`match:${matchId}`, "match:disputed", {
    matchId,
    status: "disputed",
    reason: match.disputeData.reason,
  });

  return {
    disputed: true,
    status: "disputed",
    disputeData: match.disputeData,
  };
};

/**
 * Resolves a disputed match result by an authorized administrator.
 *
 * @param {string} matchId
 * @param {string} adminId
 * @param {string} resolution
 * @param {Object} [overrideResult]
 */
export const resolveDispute = async (matchId, adminId, resolution, overrideResult) => {
  const match = await Match.findById(matchId);
  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  if (match.status !== "disputed") {
    const err = new Error(`Match is not currently disputed (status: ${match.status})`);
    err.statusCode = 400;
    throw err;
  }

  match.status = "completed";
  match.disputeData.resolvedBy = adminId;
  match.disputeData.resolution = resolution || "Dispute resolved by administrator";

  if (overrideResult) {
    match.verifiedResult = overrideResult;
  }

  await match.save();

  emitToRoom(`match:${matchId}`, "match:completed", {
    matchId,
    status: "completed",
    resolution: match.disputeData.resolution,
    verifiedResult: match.verifiedResult,
  });

  return {
    resolved: true,
    status: "completed",
    match,
  };
};

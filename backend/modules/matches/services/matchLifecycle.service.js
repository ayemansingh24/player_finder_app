import { Match } from "../models/match.model.js";
import { MatchParticipant } from "../models/matchParticipant.model.js";
import { Sport } from "../../sports/models/sport.model.js";
import { emitToRoom, emitToUser } from "../../../socket/index.js";
import { getFootballFinalResult } from "../scoring/football.scoring.js";
import { getCricketFinalResult } from "../scoring/cricket.scoring.js";
import { getBasketballFinalResult } from "../scoring/basketball.scoring.js";
import { getRacketFinalResult } from "../scoring/racketSports.scoring.js";
import { getOtherSportFinalResult } from "../scoring/otherSports.scoring.js";

/**
 * Transitions match from 'scheduled' to 'live'.
 *
 * @param {string} matchId
 * @param {string} requesterId
 */
export const startMatch = async (matchId, requesterId) => {
  const match = await Match.findById(matchId).populate("sport teamA teamB");
  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  const isCaptainA = match.teamA?.captain?.toString() === requesterId.toString();
  const isCaptainB = match.teamB?.captain?.toString() === requesterId.toString();
  const isScorekeeper = match.scorekeeper?.toString() === requesterId.toString();

  if (!isCaptainA && !isCaptainB && !isScorekeeper) {
    const err = new Error("Unauthorized to start this match");
    err.statusCode = 403;
    throw err;
  }

  if (match.status !== "scheduled") {
    const err = new Error(`Cannot start a match with status '${match.status}'`);
    err.statusCode = 400;
    throw err;
  }

  match.status = "live";
  match.startedAt = new Date();
  await match.save();

  emitToRoom(`match:${matchId}`, "match:started", {
    matchId,
    startedAt: match.startedAt,
    status: "live",
  });

  return match;
};

/**
 * Concludes live play and moves match to 'pending_verification'.
 *
 * @param {string} matchId
 * @param {string} requesterId
 */
export const endMatch = async (matchId, requesterId) => {
  const match = await Match.findById(matchId).populate("sport teamA teamB");
  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  const isScorekeeper = match.scorekeeper?.toString() === requesterId.toString();
  const isCaptainA = match.teamA?.captain?.toString() === requesterId.toString();

  if (!isScorekeeper && !isCaptainA) {
    const err = new Error("Unauthorized to end this match");
    err.statusCode = 403;
    throw err;
  }

  if (match.status !== "live") {
    const err = new Error(`Cannot end a match that is not live (current status: ${match.status})`);
    err.statusCode = 400;
    throw err;
  }

  match.status = "pending_verification";
  match.endedAt = new Date();

  // Compute preliminary result based on sport
  const sportSlug = match.sport?.slug;
  let preliminaryResult;

  if (sportSlug === "football") preliminaryResult = getFootballFinalResult(match.scoreSummary);
  else if (sportSlug === "cricket") preliminaryResult = getCricketFinalResult(match.scoreSummary);
  else if (sportSlug === "basketball") preliminaryResult = getBasketballFinalResult(match.scoreSummary);
  else if (["badminton", "pickleball", "lawn_tennis", "table_tennis"].includes(sportSlug)) {
    preliminaryResult = getRacketFinalResult(match.scoreSummary);
  } else {
    preliminaryResult = getOtherSportFinalResult(match.scoreSummary);
  }

  match.verifiedResult = preliminaryResult;
  match.verificationData = {
    teamAConfirmed: false,
    teamAConfirmedAt: null,
    teamBConfirmed: false,
    teamBConfirmedAt: null,
    resultVersion: 1,
  };

  await match.save();

  emitToRoom(`match:${matchId}`, "match:ended", {
    matchId,
    status: "pending_verification",
    preliminaryResult,
  });

  // Notify both captains to confirm result
  if (match.teamA?.captain) emitToUser(match.teamA.captain, "match:verification_requested", { matchId });
  if (match.teamB?.captain) emitToUser(match.teamB.captain, "match:verification_requested", { matchId });

  return match;
};

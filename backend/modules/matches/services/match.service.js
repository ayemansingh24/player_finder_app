import { Match } from "../models/match.model.js";
import { MatchParticipant } from "../models/matchParticipant.model.js";
import { Sport } from "../../sports/models/sport.model.js";
import { Team } from "../../teams/models/team.model.js";

/**
 * Creates a new scheduled match.
 *
 * @param {string} creatorId
 * @param {Object} data
 */
export const createMatch = async (creatorId, data) => {
  let sportDoc = await Sport.findOne({ slug: data.sportIdentifier?.toLowerCase(), isActive: true });
  if (!sportDoc && data.sportIdentifier?.match(/^[0-9a-fA-F]{24}$/)) {
    sportDoc = await Sport.findById(data.sportIdentifier);
  }
  if (!sportDoc) {
    const err = new Error(`Sport '${data.sportIdentifier}' not found`);
    err.statusCode = 404;
    throw err;
  }

  const match = await Match.create({
    sport: sportDoc._id,
    teamA: data.teamA || null,
    teamB: data.teamB || null,
    matchFormat: data.matchFormat,
    scheduledAt: data.scheduledAt,
    durationMinutes: data.durationMinutes || 60,
    venue: data.venue || {},
    scorekeeper: data.scorekeeper || creatorId,
    status: "scheduled",
  });

  return match;
};

/**
 * Retrieves all matches for a user (either as captain or confirmed participant).
 *
 * @param {string} authUserId
 */
export const getMyMatches = async (authUserId) => {
  const participations = await MatchParticipant.find({ authUser: authUserId }).select("match");
  const participatedMatchIds = participations.map((p) => p.match);

  // Teams where user is captain
  const myTeams = await Team.find({ captain: authUserId }).select("_id");
  const myTeamIds = myTeams.map((t) => t._id);

  const matches = await Match.find({
    $or: [
      { _id: { $in: participatedMatchIds } },
      { scorekeeper: authUserId },
      { teamA: { $in: myTeamIds } },
      { teamB: { $in: myTeamIds } },
    ],
  })
    .populate("sport", "name slug")
    .populate("teamA", "name logo")
    .populate("teamB", "name logo")
    .populate("scorekeeper", "username fullName")
    .sort({ scheduledAt: -1 });

  return matches;
};

/**
 * Retrieves match details by ID with populated teams and participants.
 *
 * @param {string} matchId
 */
export const getMatchById = async (matchId) => {
  const match = await Match.findById(matchId)
    .populate("sport", "name slug hasPositions positions")
    .populate({
      path: "teamA",
      select: "name captain logo preferredPlayingLocation",
      populate: { path: "captain", select: "username fullName playerCode" },
    })
    .populate({
      path: "teamB",
      select: "name captain logo preferredPlayingLocation",
      populate: { path: "captain", select: "username fullName playerCode" },
    })
    .populate("scorekeeper", "username fullName playerCode");

  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  const participants = await MatchParticipant.find({ match: matchId })
    .populate("authUser", "username fullName playerCode avatar")
    .populate("team", "name");

  const obj = match.toObject();
  obj.participants = participants;
  return obj;
};

/**
 * Updates match scheduling (venue, date/time, duration).
 *
 * @param {string} matchId
 * @param {string} requesterId
 * @param {Object} scheduleData
 */
export const scheduleMatch = async (matchId, requesterId, scheduleData) => {
  const match = await Match.findById(matchId).populate("teamA teamB");
  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  const isCaptainA = match.teamA?.captain?.toString() === requesterId.toString();
  const isCaptainB = match.teamB?.captain?.toString() === requesterId.toString();
  const isScorekeeper = match.scorekeeper?.toString() === requesterId.toString();

  if (!isCaptainA && !isCaptainB && !isScorekeeper) {
    const err = new Error("Unauthorized to reschedule this match");
    err.statusCode = 403;
    throw err;
  }

  if (match.status !== "scheduled" && match.status !== "proposed") {
    const err = new Error(`Cannot reschedule a match that is ${match.status}`);
    err.statusCode = 400;
    throw err;
  }

  if (scheduleData.scheduledAt) match.scheduledAt = scheduleData.scheduledAt;
  if (scheduleData.durationMinutes) match.durationMinutes = scheduleData.durationMinutes;
  if (scheduleData.venue) match.venue = { ...match.venue, ...scheduleData.venue };

  await match.save();
  return match;
};

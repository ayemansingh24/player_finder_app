import { Match } from "../models/match.model.js";
import { MatchEvent } from "../models/matchEvent.model.js";
import { applyFootballEvent } from "../scoring/football.scoring.js";
import { applyCricketEvent } from "../scoring/cricket.scoring.js";
import { applyBasketballEvent } from "../scoring/basketball.scoring.js";
import { applyRacketEvent } from "../scoring/racketSports.scoring.js";
import { applyOtherSportEvent } from "../scoring/otherSports.scoring.js";
import { emitToRoom } from "../../../socket/index.js";

/**
 * Records a scoring or gameplay event for a live match. Idempotent via clientEventId.
 *
 * @param {string} matchId
 * @param {string} scorekeeperId
 * @param {Object} eventData
 */
export const recordEvent = async (matchId, scorekeeperId, eventData) => {
  const match = await Match.findById(matchId).populate("sport");
  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  // Authorization check: only authorized scorekeeper can record events
  if (match.scorekeeper.toString() !== scorekeeperId.toString()) {
    const err = new Error("Only the assigned scorekeeper can record live scoring events");
    err.statusCode = 403;
    throw err;
  }

  if (match.status !== "live") {
    const err = new Error(`Cannot record events for a match that is not live (current status: ${match.status})`);
    err.statusCode = 400;
    throw err;
  }

  // Idempotency: Check if clientEventId has already been processed
  if (eventData.clientEventId) {
    const existing = await MatchEvent.findOne({
      match: matchId,
      clientEventId: eventData.clientEventId,
    });
    if (existing) {
      return {
        idempotent: true,
        event: existing,
        scoreSummary: match.scoreSummary,
      };
    }
  }

  const sportSlug = match.sport?.slug || "football";

  // Delegate event application to sport scoring strategy
  let updatedScore = match.scoreSummary;
  if (sportSlug === "football") {
    updatedScore = applyFootballEvent(match.scoreSummary, eventData);
  } else if (sportSlug === "cricket") {
    updatedScore = applyCricketEvent(match.scoreSummary, eventData);
  } else if (sportSlug === "basketball") {
    updatedScore = applyBasketballEvent(match.scoreSummary, eventData);
  } else if (["badminton", "pickleball", "lawn_tennis", "table_tennis"].includes(sportSlug)) {
    updatedScore = applyRacketEvent(match.scoreSummary, eventData);
  } else {
    updatedScore = applyOtherSportEvent(match.scoreSummary, eventData);
  }

  // Persist MatchEvent
  const savedEvent = await MatchEvent.create({
    match: matchId,
    sport: sportSlug,
    eventType: eventData.eventType,
    side: eventData.side,
    player: eventData.player || null,
    eventData: eventData.eventData || {},
    recordedBy: scorekeeperId,
    clientEventId: eventData.clientEventId || null,
    serverTimestamp: new Date(),
  });

  // Update Match score summary atomically
  match.scoreSummary = updatedScore;
  await match.save();

  // Emit live score update to all spectators in the match Socket room
  emitToRoom(`match:${matchId}`, "match:score_update", {
    matchId,
    event: savedEvent,
    scoreSummary: updatedScore,
  });

  return {
    event: savedEvent,
    scoreSummary: updatedScore,
  };
};

/**
 * Retrieves the current live score and recent events for a match.
 *
 * @param {string} matchId
 */
export const getLiveScore = async (matchId) => {
  const match = await Match.findById(matchId)
    .populate("sport", "name slug")
    .select("status scoreSummary startedAt endedAt matchFormat");

  if (!match) {
    const err = new Error("Match not found");
    err.statusCode = 404;
    throw err;
  }

  const recentEvents = await MatchEvent.find({ match: matchId })
    .populate("player", "username fullName playerCode")
    .sort({ serverTimestamp: -1 })
    .limit(20);

  return {
    matchId: match._id,
    status: match.status,
    scoreSummary: match.scoreSummary,
    startedAt: match.startedAt,
    recentEvents,
  };
};

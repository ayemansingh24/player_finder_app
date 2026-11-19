/**
 * otherSports.scoring.js
 *
 * Scoring and result handlers for Chess and Swimming.
 */

export const initOtherSportScore = (sportSlug) => {
  if (sportSlug === "chess") {
    return {
      white: "teamA",
      black: "teamB",
      movesCount: 0,
      result: "in_progress",
    };
  }
  if (sportSlug === "swimming") {
    return {
      eventStyle: "freestyle",
      laps: [],
      finished: false,
    };
  }
  return { status: "in_progress" };
};

export const applyOtherSportEvent = (currentScore, event) => {
  const score = currentScore ? { ...currentScore } : {};
  const { eventType, eventData = {} } = event;

  if (eventType === "move") {
    score.movesCount = (score.movesCount || 0) + 1;
    score.lastMove = eventData.notation || "";
  } else if (eventType === "lap") {
    score.laps = score.laps || [];
    score.laps.push({ timeMs: eventData.timeMs, lapNumber: eventData.lapNumber });
  } else if (eventType === "result_declared") {
    score.declaredResult = eventData.result;
    score.winnerSide = eventData.winnerSide;
  }

  return score;
};

export const getOtherSportFinalResult = (score) => {
  return {
    winner: score?.winnerSide || "draw",
    summary: score?.declaredResult || "Match concluded",
  };
};

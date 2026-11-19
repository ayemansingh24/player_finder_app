/**
 * football.scoring.js
 *
 * Football score summary calculation and live event handling.
 */

export const initFootballScore = () => ({
  teamA: { goals: 0 },
  teamB: { goals: 0 },
  currentMinute: 0,
  half: 1,
});

export const applyFootballEvent = (currentScore, event) => {
  const score = currentScore && currentScore.teamA ? { ...currentScore } : initFootballScore();
  const { eventType, side, eventData = {} } = event;

  if (eventType === "goal") {
    if (side === "teamA") score.teamA.goals += 1;
    if (side === "teamB") score.teamB.goals += 1;
  } else if (eventType === "own_goal") {
    // An own goal awards a point to the opposing side
    if (side === "teamA") score.teamB.goals += 1;
    if (side === "teamB") score.teamA.goals += 1;
  } else if (eventType === "clock_update") {
    if (typeof eventData.minute === "number") score.currentMinute = eventData.minute;
    if (typeof eventData.half === "number") score.half = eventData.half;
  }

  return score;
};

export const getFootballFinalResult = (score) => {
  const goalsA = score?.teamA?.goals || 0;
  const goalsB = score?.teamB?.goals || 0;

  let winner = "draw";
  if (goalsA > goalsB) winner = "teamA";
  else if (goalsB > goalsA) winner = "teamB";

  return {
    teamA: goalsA,
    teamB: goalsB,
    winner,
    summary: `${goalsA} - ${goalsB}`,
  };
};

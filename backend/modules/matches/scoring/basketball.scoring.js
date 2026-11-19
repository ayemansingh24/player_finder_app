/**
 * basketball.scoring.js
 *
 * Basketball score calculation (1, 2, 3-pointers, quarters/periods).
 */

export const initBasketballScore = () => ({
  teamA: { points: 0, fouls: 0 },
  teamB: { points: 0, fouls: 0 },
  period: 1,
});

export const applyBasketballEvent = (currentScore, event) => {
  const score = currentScore && currentScore.teamA ? { ...currentScore } : initBasketballScore();
  const { eventType, side, eventData = {} } = event;

  if (eventType === "point" || eventType === "score") {
    const pts = Number(eventData.points) || 2;
    if (side === "teamA") score.teamA.points += pts;
    if (side === "teamB") score.teamB.points += pts;
  } else if (eventType === "foul") {
    if (side === "teamA") score.teamA.fouls += 1;
    if (side === "teamB") score.teamB.fouls += 1;
  } else if (eventType === "period_change") {
    score.period = Number(eventData.period) || score.period + 1;
  }

  return score;
};

export const getBasketballFinalResult = (score) => {
  const ptsA = score?.teamA?.points || 0;
  const ptsB = score?.teamB?.points || 0;

  let winner = "draw";
  if (ptsA > ptsB) winner = "teamA";
  else if (ptsB > ptsA) winner = "teamB";

  return {
    teamA: ptsA,
    teamB: ptsB,
    winner,
    summary: `${ptsA} - ${ptsB}`,
  };
};

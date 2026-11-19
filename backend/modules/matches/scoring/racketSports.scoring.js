/**
 * racketSports.scoring.js
 *
 * Scoring for racket sports: Badminton, Table Tennis, Pickleball, Lawn Tennis.
 * Handles points, games, and sets.
 */

export const initRacketScore = () => ({
  teamA: { points: 0, sets: 0, currentSetPoints: [] },
  teamB: { points: 0, sets: 0, currentSetPoints: [] },
  currentSet: 1,
});

export const applyRacketEvent = (currentScore, event) => {
  const score = currentScore && currentScore.teamA ? { ...currentScore } : initRacketScore();
  const { eventType, side, eventData = {} } = event;

  if (eventType === "point") {
    if (side === "teamA") score.teamA.points += 1;
    if (side === "teamB") score.teamB.points += 1;
  } else if (eventType === "set_won") {
    const winnerSide = side || eventData.winnerSide;
    if (winnerSide === "teamA") score.teamA.sets += 1;
    if (winnerSide === "teamB") score.teamB.sets += 1;

    score.teamA.currentSetPoints.push(score.teamA.points);
    score.teamB.currentSetPoints.push(score.teamB.points);

    score.teamA.points = 0;
    score.teamB.points = 0;
    score.currentSet += 1;
  }

  return score;
};

export const getRacketFinalResult = (score) => {
  const setsA = score?.teamA?.sets || 0;
  const setsB = score?.teamB?.sets || 0;

  let winner = "draw";
  if (setsA > setsB) winner = "teamA";
  else if (setsB > setsA) winner = "teamB";

  return {
    sets: `${setsA} - ${setsB}`,
    teamA: setsA,
    teamB: setsB,
    winner,
    summary: `${setsA} sets to ${setsB}`,
  };
};

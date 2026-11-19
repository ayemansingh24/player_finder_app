/**
 * cricket.scoring.js
 *
 * Cricket score summary calculation (runs, wickets, overs, legal deliveries).
 */

export const initCricketScore = () => ({
  teamA: { runs: 0, wickets: 0, overs: 0, balls: 0, extras: 0 },
  teamB: { runs: 0, wickets: 0, overs: 0, balls: 0, extras: 0 },
  currentInning: 1, // 1 for teamA batting, 2 for teamB batting
  battingSide: "teamA",
  targetRuns: null,
});

export const applyCricketEvent = (currentScore, event) => {
  const score = currentScore && currentScore.teamA ? { ...currentScore } : initCricketScore();
  const side = score.battingSide || "teamA";
  const { eventType, eventData = {} } = event;

  if (eventType === "run") {
    const runs = Number(eventData.runs) || 0;
    score[side].runs += runs;
    if (eventData.isLegalDelivery !== false) {
      score[side].balls += 1;
      if (score[side].balls >= 6) {
        score[side].overs += 1;
        score[side].balls = 0;
      }
    }
  } else if (eventType === "wicket") {
    score[side].wickets += 1;
    if (eventData.isLegalDelivery !== false) {
      score[side].balls += 1;
      if (score[side].balls >= 6) {
        score[side].overs += 1;
        score[side].balls = 0;
      }
    }
  } else if (eventType === "extra") {
    const extras = Number(eventData.runs) || 1;
    score[side].runs += extras;
    score[side].extras += extras;
  } else if (eventType === "switch_innings") {
    score.currentInning = 2;
    score.targetRuns = score.teamA.runs + 1;
    score.battingSide = "teamB";
  }

  return score;
};

export const getCricketFinalResult = (score) => {
  const runsA = score?.teamA?.runs || 0;
  const runsB = score?.teamB?.runs || 0;
  const wicketsA = score?.teamA?.wickets || 0;
  const wicketsB = score?.teamB?.wickets || 0;

  let winner = "draw";
  let margin = "";

  if (runsA > runsB) {
    winner = "teamA";
    margin = `by ${runsA - runsB} runs`;
  } else if (runsB > runsA) {
    winner = "teamB";
    const wicketsLeft = 10 - wicketsB;
    margin = `by ${wicketsLeft} wickets`;
  } else {
    margin = "Tied match";
  }

  return {
    teamA: `${runsA}/${wicketsA}`,
    teamB: `${runsB}/${wicketsB}`,
    winner,
    summary: `${winner.toUpperCase()} won ${margin}`,
  };
};

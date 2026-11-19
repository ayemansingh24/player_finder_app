import { Team } from "../models/team.model.js";
import { TeamMembership } from "../models/teamMembership.model.js";
import { UserSport } from "../../userSports/models/userSport.model.js";

/**
 * Validates team lineup eligibility for a match (Section 47).
 *
 * @param {string} teamId
 * @param {Array<string>} playerUserIds
 * @param {string} requiredSportId
 * @param {number} [requiredLineupSize]
 */
export const validateLineupEligibility = async (
  teamId,
  playerUserIds,
  requiredSportId,
  requiredLineupSize
) => {
  if (!Array.isArray(playerUserIds) || playerUserIds.length === 0) {
    return {
      isEligible: false,
      reason: "Lineup cannot be empty",
    };
  }

  // 1. Check for duplicates within the submitted lineup
  const uniqueIds = Array.from(new Set(playerUserIds.map((id) => id.toString())));
  if (uniqueIds.length !== playerUserIds.length) {
    return {
      isEligible: false,
      reason: "Duplicate players detected in lineup",
    };
  }

  // 2. Validate lineup size if specified
  if (requiredLineupSize && uniqueIds.length !== requiredLineupSize) {
    return {
      isEligible: false,
      reason: `Lineup must contain exactly ${requiredLineupSize} players. Received ${uniqueIds.length}.`,
    };
  }

  // 3. Verify confirmed team memberships
  const memberships = await TeamMembership.find({
    team: teamId,
    authUser: { $in: uniqueIds },
    status: "confirmed",
  }).select("authUser");

  const confirmedUserIds = memberships.map((m) => m.authUser.toString());
  const missingMembers = uniqueIds.filter((id) => !confirmedUserIds.includes(id));

  if (missingMembers.length > 0) {
    return {
      isEligible: false,
      reason: `${missingMembers.length} player(s) do not have confirmed membership in this team`,
      missingUserIds: missingMembers,
    };
  }

  // 4. Verify all players are registered for the required sport
  const registeredSports = await UserSport.find({
    authUser: { $in: uniqueIds },
    sport: requiredSportId,
  }).select("authUser");

  const registeredUserIds = registeredSports.map((us) => us.authUser.toString());
  const missingSportPlayers = uniqueIds.filter((id) => !registeredUserIds.includes(id));

  if (missingSportPlayers.length > 0) {
    return {
      isEligible: false,
      reason: `${missingSportPlayers.length} player(s) are not registered for this sport`,
      unregisteredUserIds: missingSportPlayers,
    };
  }

  return {
    isEligible: true,
    playerCount: uniqueIds.length,
    validatedUserIds: uniqueIds,
  };
};

/**
 * Cross-checks opposing lineups to ensure no single player appears on both sides.
 *
 * @param {Array<string>} lineupA
 * @param {Array<string>} lineupB
 */
export const checkCrossLineupConflicts = (lineupA = [], lineupB = []) => {
  const setA = new Set(lineupA.map((id) => id.toString()));
  const conflicts = lineupB.filter((id) => setA.has(id.toString()));

  return {
    hasConflict: conflicts.length > 0,
    conflictingUserIds: conflicts,
  };
};

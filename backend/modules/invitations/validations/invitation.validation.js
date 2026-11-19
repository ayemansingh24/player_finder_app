/**
 * Validates invitation creation payload based on invitation type.
 *
 * @param {Object} data - Request body
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateInvitationCreate(data) {
  const { type, receiverUser, teamId, senderTeam, receiverTeam, sport, expiresAt } = data;

  if (!type) {
    return { valid: false, error: "Invitation type is required" };
  }

  const allowedTypes = ["player_match", "team_membership", "team_challenge"];
  if (!allowedTypes.includes(type)) {
    return {
      valid: false,
      error: `type must be one of: ${allowedTypes.join(", ")}`,
    };
  }

  if (type === "player_match") {
    if (!sport) return { valid: false, error: "sport is required for player_match invitations" };
    if (!receiverUser) return { valid: false, error: "receiverUser is required for player_match invitations" };
  }

  if (type === "team_membership") {
    if (!receiverUser) return { valid: false, error: "receiverUser is required for team_membership invitations" };
    if (!teamId) return { valid: false, error: "teamId is required for team_membership invitations" };
  }

  if (type === "team_challenge") {
    if (!senderTeam) return { valid: false, error: "senderTeam is required for team_challenge invitations" };
    if (!receiverTeam) return { valid: false, error: "receiverTeam is required for team_challenge invitations" };
    if (!sport) return { valid: false, error: "sport is required for team_challenge invitations" };
  }

  // Optional: validate proposedArrangement.durationMinutes if provided
  if (data.proposedArrangement?.durationMinutes !== undefined) {
    const dur = Number(data.proposedArrangement.durationMinutes);
    if (!Number.isInteger(dur) || dur < 1 || dur > 1440) {
      return { valid: false, error: "proposedArrangement.durationMinutes must be between 1 and 1440" };
    }
  }

  // Optional: validate custom expiresAt
  if (expiresAt !== undefined) {
    const exp = new Date(expiresAt);
    if (isNaN(exp.getTime()) || exp <= new Date()) {
      return { valid: false, error: "expiresAt must be a valid future date" };
    }
  }

  return { valid: true };
}

/**
 * Validates filters for listing invitations.
 *
 * @param {Object} query - Request query params
 * @returns {{ valid: boolean, error?: string, filters: Object }}
 */
export function validateInvitationFilters(query) {
  const { status, type, page, limit } = query;
  const filters = {};

  const allowedStatuses = ["pending", "accepted", "rejected", "expired", "cancelled"];
  if (status) {
    if (!allowedStatuses.includes(status)) {
      return { valid: false, error: `status must be one of: ${allowedStatuses.join(", ")}` };
    }
    filters.status = status;
  }

  const allowedTypes = ["player_match", "team_membership", "team_challenge"];
  if (type) {
    if (!allowedTypes.includes(type)) {
      return { valid: false, error: `type must be one of: ${allowedTypes.join(", ")}` };
    }
    filters.type = type;
  }

  filters.page = Math.max(1, parseInt(page) || 1);
  filters.limit = Math.min(50, Math.max(1, parseInt(limit) || 20));

  return { valid: true, filters };
}

import { Invitation } from "../models/invitation.model.js";
import { TeamMembership } from "../../teams/models/teamMembership.model.js";
import { recordRecruitmentAcceptance } from "../../teams/services/recruitment.service.js";
import { emitToUser } from "../../../socket/index.js";

/**
 * Accepts a pending invitation and performs domain-specific side effects.
 *
 * @param {string} invitationId
 * @param {string} requesterId
 */
export const acceptInvitation = async (invitationId, requesterId) => {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation) {
    const err = new Error("Invitation not found");
    err.statusCode = 404;
    throw err;
  }

  // Authorization check: must be receiverUser
  if (invitation.receiverUser.toString() !== requesterId.toString()) {
    const err = new Error("You are not authorized to accept this invitation");
    err.statusCode = 403;
    throw err;
  }

  if (invitation.status !== "pending") {
    const err = new Error(`Invitation is already ${invitation.status}`);
    err.statusCode = 400;
    throw err;
  }

  // Check expiration directly during acceptance (Section 33)
  if (new Date() > new Date(invitation.expiresAt)) {
    invitation.status = "expired";
    await invitation.save();
    const err = new Error("This invitation has expired");
    err.statusCode = 400;
    throw err;
  }

  // 1. Process Type-Specific Side Effects
  let createdMatch = null;

  if (invitation.type === "team_membership") {
    // Confirm team membership idempotently
    await TeamMembership.findOneAndUpdate(
      { team: invitation.teamId, authUser: requesterId },
      {
        $setOnInsert: {
          team: invitation.teamId,
          authUser: requesterId,
          role: "member",
          status: "confirmed",
          joinedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  } else if (invitation.type === "player_match") {
    // If linked to recruitment request, record slot atomically
    if (invitation.recruitmentRequestId) {
      await recordRecruitmentAcceptance(invitation.recruitmentRequestId);
    }
  } else if (invitation.type === "team_challenge") {
    // Create scheduled match via dynamic Match import to prevent circular dependencies
    const { Match } = await import("../../matches/models/match.model.js");
    const { MatchParticipant } = await import("../../matches/models/matchParticipant.model.js");

    const venue = invitation.proposedArrangement?.venue || "TBD";
    const scheduledAt = invitation.proposedArrangement?.scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
    const durationMinutes = invitation.proposedArrangement?.durationMinutes || 60;
    const matchFormat = invitation.proposedArrangement?.matchFormat || "standard";

    const match = await Match.create({
      sport: invitation.sport,
      teamA: invitation.senderTeam,
      teamB: invitation.receiverTeam,
      originatingInvitation: invitation._id,
      matchFormat,
      scheduledAt,
      durationMinutes,
      venue: { name: venue },
      scorekeeper: invitation.sender,
      status: "scheduled",
    });

    invitation.matchId = match._id;
    createdMatch = match;
  }

  // 2. Transition Invitation Status Atomically
  invitation.status = "accepted";
  invitation.respondedAt = new Date();
  await invitation.save();

  // 3. Emit Real-time Socket Event to the Sender
  emitToUser(invitation.sender, "invitation:accepted", {
    invitationId: invitation._id,
    type: invitation.type,
    acceptedBy: requesterId,
    matchId: createdMatch?._id || null,
  });

  return {
    accepted: true,
    invitation,
    createdMatch,
  };
};

/**
 * Rejects a pending invitation and provides availability follow-up prompt options (Section 39).
 *
 * @param {string} invitationId
 * @param {string} requesterId
 * @param {string} [reason]
 */
export const rejectInvitation = async (invitationId, requesterId, reason = null) => {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation) {
    const err = new Error("Invitation not found");
    err.statusCode = 404;
    throw err;
  }

  if (invitation.receiverUser.toString() !== requesterId.toString()) {
    const err = new Error("You are not authorized to reject this invitation");
    err.statusCode = 403;
    throw err;
  }

  if (invitation.status !== "pending") {
    const err = new Error(`Invitation is already ${invitation.status}`);
    err.statusCode = 400;
    throw err;
  }

  invitation.status = "rejected";
  invitation.respondedAt = new Date();
  await invitation.save();

  // Notify sender of rejection
  emitToUser(invitation.sender, "invitation:rejected", {
    invitationId: invitation._id,
    rejectedBy: requesterId,
  });

  // Section 39: Return activity preference options prompt for client UI
  return {
    rejected: true,
    invitationId: invitation._id,
    availabilityPrompt: {
      question: "Would you like to continue receiving match invitations?",
      options: [
        { label: "Stay Active", action: "stay_active" },
        { label: "Inactive Until Further Notice", action: "indefinite_inactive" },
        { label: "Temporarily Inactive (Pause)", action: "pause" },
        { label: "Schedule Availability", action: "schedule" },
      ],
    },
  };
};

/**
 * Cancels a pending invitation. Restricted to the original sender.
 *
 * @param {string} invitationId
 * @param {string} senderId
 */
export const cancelInvitation = async (invitationId, senderId) => {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation) {
    const err = new Error("Invitation not found");
    err.statusCode = 404;
    throw err;
  }

  if (invitation.sender.toString() !== senderId.toString()) {
    const err = new Error("Only the sender can cancel this invitation");
    err.statusCode = 403;
    throw err;
  }

  if (invitation.status !== "pending") {
    const err = new Error(`Cannot cancel an invitation that is already ${invitation.status}`);
    err.statusCode = 400;
    throw err;
  }

  invitation.status = "cancelled";
  invitation.cancelledAt = new Date();
  await invitation.save();

  emitToUser(invitation.receiverUser, "invitation:cancelled", {
    invitationId: invitation._id,
  });

  return { cancelled: true, invitationId: invitation._id };
};

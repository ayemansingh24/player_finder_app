import { Invitation } from "../models/invitation.model.js";
import { User } from "../../auth/models/user.model.js";
import { UserProfile } from "../../user/models/userProfile.model.js";
import { Team } from "../../teams/models/team.model.js";
import { Sport } from "../../sports/models/sport.model.js";
import { getEffectiveAvailability } from "../../availability/utils/availabilityCalculator.js";
import { emitToUser } from "../../../socket/index.js";

/**
 * Creates and persists a new invitation with thorough validation and authorization checks.
 *
 * @param {string} senderId
 * @param {Object} data
 */
export const createInvitation = async (senderId, data) => {
  const {
    type,
    receiverUser,
    receiverPlayerCode,
    teamId,
    senderTeam,
    receiverTeam,
    sport,
    sportSlug,
    matchId,
    recruitmentRequestId,
    proposedArrangement,
    message,
    expiresAt,
  } = data;

  // Resolve target receiver user (supports direct receiverUser ObjectId or receiverPlayerCode)
  let targetReceiverUserId = receiverUser;
  if (!targetReceiverUserId && receiverPlayerCode) {
    const code = receiverPlayerCode.trim().replace(/^#/, "");
    const foundUser = await User.findOne({ playerCode: code });
    if (!foundUser) {
      const err = new Error(`No player found with Player Code #${code}`);
      err.statusCode = 404;
      throw err;
    }
    targetReceiverUserId = foundUser._id;
  }

  // Resolve Sport
  let resolvedSportId = sport;
  if (!resolvedSportId && sportSlug) {
    const sportDoc = await Sport.findOne({ slug: sportSlug.toLowerCase().trim(), isActive: true });
    if (sportDoc) resolvedSportId = sportDoc._id;
  }

  // 1. Validate Type: player_match
  if (type === "player_match") {
    if (!targetReceiverUserId) {
      const err = new Error("receiverUser is required for player_match invitations");
      err.statusCode = 400;
      throw err;
    }

    if (senderId.toString() === targetReceiverUserId.toString()) {
      const err = new Error("You cannot send a match invitation to yourself");
      err.statusCode = 400;
      throw err;
    }

    // Check receiver effective availability (Section 34 & 74: Recheck before sending)
    const receiverProfile = await UserProfile.findOne({ authUser: targetReceiverUserId });
    if (receiverProfile) {
      const availability = getEffectiveAvailability(receiverProfile, new Date());
      if (!availability.isAvailable) {
        const err = new Error(`Player is currently unavailable for match invitations (${availability.effectiveStatus})`);
        err.statusCode = 409;
        throw err;
      }
    }
  }

  // 2. Validate Type: team_membership
  if (type === "team_membership") {
    if (!teamId) {
      const err = new Error("teamId is required for team_membership invitations");
      err.statusCode = 400;
      throw err;
    }

    const team = await Team.findById(teamId);
    if (!team) {
      const err = new Error("Team not found");
      err.statusCode = 404;
      throw err;
    }

    if (team.captain.toString() !== senderId.toString()) {
      const err = new Error("Only the team captain can invite new members");
      err.statusCode = 403;
      throw err;
    }

    if (senderId.toString() === targetReceiverUserId?.toString()) {
      const err = new Error("Captain is already a confirmed member of their own team");
      err.statusCode = 400;
      throw err;
    }
  }

  // 3. Validate Type: team_challenge
  if (type === "team_challenge") {
    if (!senderTeam || !receiverTeam) {
      const err = new Error("senderTeam and receiverTeam are required for team challenges");
      err.statusCode = 400;
      throw err;
    }

    if (senderTeam.toString() === receiverTeam.toString()) {
      const err = new Error("A team cannot challenge itself");
      err.statusCode = 400;
      throw err;
    }

    const [sTeam, rTeam] = await Promise.all([Team.findById(senderTeam), Team.findById(receiverTeam)]);
    if (!sTeam || !rTeam) {
      const err = new Error("One or both challenge teams not found");
      err.statusCode = 404;
      throw err;
    }

    if (sTeam.captain.toString() !== senderId.toString()) {
      const err = new Error("Only the challenging team captain can issue challenges");
      err.statusCode = 403;
      throw err;
    }

    if (!rTeam.challengeEnabled) {
      const err = new Error(`Team '${rTeam.name}' is currently not accepting challenges`);
      err.statusCode = 400;
      throw err;
    }

    if (sTeam.sport.toString() !== rTeam.sport.toString()) {
      const err = new Error("Both teams must play the same sport to schedule a challenge");
      err.statusCode = 400;
      throw err;
    }

    resolvedSportId = sTeam.sport;
    targetReceiverUserId = rTeam.captain; // Directed to opponent captain
  }

  // Check duplicate pending invitations
  const existingPending = await Invitation.findOne({
    sender: senderId,
    receiverUser: targetReceiverUserId,
    type,
    teamId: teamId || senderTeam || null,
    status: "pending",
  });

  if (existingPending) {
    const err = new Error("A pending invitation of this type already exists for this recipient");
    err.statusCode = 409;
    throw err;
  }

  // Default expiration: 48 hours
  const expiryDate = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 48 * 60 * 60 * 1000);

  const invitation = await Invitation.create({
    type,
    sender: senderId,
    receiverUser: targetReceiverUserId,
    senderTeam: senderTeam || teamId || null,
    receiverTeam: receiverTeam || null,
    teamId: teamId || null,
    matchId: matchId || null,
    recruitmentRequestId: recruitmentRequestId || null,
    sport: resolvedSportId || null,
    proposedArrangement: proposedArrangement || {},
    message: message || null,
    status: "pending",
    expiresAt: expiryDate,
  });

  // Populate references for rich response & notification
  await invitation.populate("sender", "username fullName playerCode avatar");
  await invitation.populate("receiverUser", "username fullName playerCode");
  if (invitation.sport) await invitation.populate("sport", "name slug");
  if (invitation.teamId) await invitation.populate("teamId", "name sport");
  if (invitation.senderTeam) await invitation.populate("senderTeam", "name");
  if (invitation.receiverTeam) await invitation.populate("receiverTeam", "name");

  // Real-time notification via Socket.IO
  emitToUser(targetReceiverUserId, "invitation:new", invitation);

  return invitation;
};

/**
 * Lists received invitations for a user with status/type filtering and pagination.
 *
 * @param {string} receiverUserId
 * @param {Object} filters
 */
export const getReceivedInvitations = async (receiverUserId, filters = {}) => {
  const query = { receiverUser: receiverUserId };

  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.limit || 20));
  const skip = (page - 1) * limit;

  const [invitations, total] = await Promise.all([
    Invitation.find(query)
      .populate("sender", "username fullName playerCode avatar")
      .populate("sport", "name slug")
      .populate("teamId", "name")
      .populate("senderTeam", "name")
      .populate("receiverTeam", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invitation.countDocuments(query),
  ]);

  return { invitations, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Lists invitations sent by a user.
 *
 * @param {string} senderId
 * @param {Object} filters
 */
export const getSentInvitations = async (senderId, filters = {}) => {
  const query = { sender: senderId };

  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.limit || 20));
  const skip = (page - 1) * limit;

  const [invitations, total] = await Promise.all([
    Invitation.find(query)
      .populate("receiverUser", "username fullName playerCode avatar")
      .populate("sport", "name slug")
      .populate("teamId", "name")
      .populate("senderTeam", "name")
      .populate("receiverTeam", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invitation.countDocuments(query),
  ]);

  return { invitations, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Retrieves a single invitation by ID. Ensures user is either sender or receiver.
 *
 * @param {string} invitationId
 * @param {string} requesterId
 */
export const getInvitationById = async (invitationId, requesterId) => {
  const invitation = await Invitation.findById(invitationId)
    .populate("sender", "username fullName playerCode avatar")
    .populate("receiverUser", "username fullName playerCode avatar")
    .populate("sport", "name slug hasPositions positions")
    .populate("teamId", "name preferredPlayingLocation")
    .populate("senderTeam", "name preferredPlayingLocation")
    .populate("receiverTeam", "name preferredPlayingLocation");

  if (!invitation) {
    const err = new Error("Invitation not found");
    err.statusCode = 404;
    throw err;
  }

  const isSender = invitation.sender._id.toString() === requesterId.toString();
  const isReceiver = invitation.receiverUser?._id.toString() === requesterId.toString();

  if (!isSender && !isReceiver) {
    const err = new Error("Unauthorized to view this invitation");
    err.statusCode = 403;
    throw err;
  }

  return invitation;
};

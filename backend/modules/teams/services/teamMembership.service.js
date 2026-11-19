import { Team } from "../models/team.model.js";
import { TeamMembership } from "../models/teamMembership.model.js";
import { User } from "../../auth/models/user.model.js";

/**
 * Lists all confirmed members of a team.
 *
 * @param {string} teamId
 */
export const getTeamMembers = async (teamId) => {
  const members = await TeamMembership.find({
    team: teamId,
    status: "confirmed",
  })
    .populate("authUser", "username fullName playerCode avatar")
    .sort({ role: 1, joinedAt: 1 });

  return members.map((m) => ({
    membershipId: m._id,
    userId: m.authUser?._id,
    username: m.authUser?.username,
    displayName: m.authUser?.fullName,
    playerCode: m.authUser?.playerCode,
    avatar: m.authUser?.avatar?.url,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
};

/**
 * Removes a member from a team.
 * Allowed if:
 * 1. The requester is the team captain (removing a member)
 * 2. The requester is the member themselves (leaving the team)
 * Captain cannot leave without first transferring captaincy.
 *
 * @param {string} teamId
 * @param {string} targetUserId
 * @param {string} requesterId
 */
export const removeMember = async (teamId, targetUserId, requesterId) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const err = new Error("Team not found");
    err.statusCode = 404;
    throw err;
  }

  const isCaptain = team.captain.toString() === requesterId.toString();
  const isSelf = targetUserId.toString() === requesterId.toString();

  if (!isCaptain && !isSelf) {
    const err = new Error("You are not authorized to remove this member");
    err.statusCode = 403;
    throw err;
  }

  if (team.captain.toString() === targetUserId.toString()) {
    const err = new Error("Team captain cannot leave the team without transferring captaincy first");
    err.statusCode = 400;
    throw err;
  }

  const result = await TeamMembership.findOneAndDelete({
    team: teamId,
    authUser: targetUserId,
  });

  if (!result) {
    const err = new Error("Membership not found");
    err.statusCode = 404;
    throw err;
  }

  return { removed: true, userId: targetUserId, teamId };
};

/**
 * Atomically transfers team captaincy to another confirmed team member.
 *
 * @param {string} teamId
 * @param {string} currentCaptainId
 * @param {string} newCaptainId
 */
export const transferCaptain = async (teamId, currentCaptainId, newCaptainId) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const err = new Error("Team not found");
    err.statusCode = 404;
    throw err;
  }

  if (team.captain.toString() !== currentCaptainId.toString()) {
    const err = new Error("Only the current captain can transfer captaincy");
    err.statusCode = 403;
    throw err;
  }

  if (currentCaptainId.toString() === newCaptainId.toString()) {
    const err = new Error("Cannot transfer captaincy to yourself");
    err.statusCode = 400;
    throw err;
  }

  // Ensure target user is a confirmed member of this team
  const targetMembership = await TeamMembership.findOne({
    team: teamId,
    authUser: newCaptainId,
    status: "confirmed",
  });

  if (!targetMembership) {
    const err = new Error("Target user is not a confirmed member of this team");
    err.statusCode = 400;
    throw err;
  }

  // Demote previous captain
  await TeamMembership.findOneAndUpdate(
    { team: teamId, authUser: currentCaptainId },
    { $set: { role: "member" } }
  );

  // Promote new captain
  targetMembership.role = "captain";
  await targetMembership.save();

  // Update Team document
  team.captain = newCaptainId;
  await team.save();

  return {
    transferred: true,
    previousCaptain: currentCaptainId,
    newCaptain: newCaptainId,
  };
};

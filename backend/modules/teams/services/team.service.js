import { Team } from "../models/team.model.js";
import { TeamMembership } from "../models/teamMembership.model.js";
import { Sport } from "../../sports/models/sport.model.js";
import { calculateH3Cells } from "../../../utils/h3.utils.js";

/**
 * Creates a new team and registers the creator as its confirmed Captain.
 *
 * @param {string} captainId
 * @param {Object} data
 */
export const createTeam = async (captainId, data) => {
  // Resolve sport
  let sportDoc = await Sport.findOne({ slug: data.sportIdentifier?.toLowerCase(), isActive: true });
  if (!sportDoc && data.sportIdentifier?.match(/^[0-9a-fA-F]{24}$/)) {
    sportDoc = await Sport.findById(data.sportIdentifier);
  }
  if (!sportDoc) {
    const err = new Error(`Sport '${data.sportIdentifier}' not found`);
    err.statusCode = 404;
    throw err;
  }

  const [lng, lat] = data.preferredPlayingLocation.coordinates;
  const h3 = calculateH3Cells(lat, lng);

  const team = await Team.create({
    name: data.name,
    sport: sportDoc._id,
    captain: captainId,
    description: data.description || "",
    type: data.type || "permanent",
    preferredPlayingLocation: {
      geo: {
        type: "Point",
        coordinates: [lng, lat],
      },
      venueName: data.preferredPlayingLocation.venueName || "",
      city: data.preferredPlayingLocation.city || "",
      state: data.preferredPlayingLocation.state || "",
      country: data.preferredPlayingLocation.country || "",
    },
    h3Cells: {
      res7: h3.res7,
      res8: h3.res8,
    },
    matchFormats: data.matchFormats || [],
    visibility: data.visibility || "public",
    challengeEnabled: data.challengeEnabled !== undefined ? data.challengeEnabled : true,
    status: "active",
  });

  // Automatically register captain in TeamMembership
  await TeamMembership.create({
    team: team._id,
    authUser: captainId,
    role: "captain",
    status: "confirmed",
    joinedAt: new Date(),
  });

  await team.populate("sport", "name slug hasPositions positions");
  return team;
};

/**
 * Retrieves all teams where the user is an active/confirmed member or captain.
 *
 * @param {string} authUserId
 */
export const getMyTeams = async (authUserId) => {
  const memberships = await TeamMembership.find({
    authUser: authUserId,
    status: "confirmed",
  }).select("team role joinedAt");

  const teamIds = memberships.map((m) => m.team);

  const teams = await Team.find({
    _id: { $in: teamIds },
    status: { $ne: "disbanded" },
  })
    .populate("sport", "name slug")
    .populate("captain", "username fullName playerCode");

  return teams.map((t) => {
    const mem = memberships.find((m) => m.team.toString() === t._id.toString());
    const obj = t.toObject();
    obj.myRole = mem?.role || "member";
    return obj;
  });
};

/**
 * Retrieves detailed info for a single team by its ID.
 *
 * @param {string} teamId
 */
export const getTeamById = async (teamId) => {
  const team = await Team.findById(teamId)
    .populate("sport", "name slug hasPositions positions")
    .populate("captain", "username fullName playerCode avatar");

  if (!team) {
    const err = new Error("Team not found");
    err.statusCode = 404;
    throw err;
  }

  const memberCount = await TeamMembership.countDocuments({
    team: teamId,
    status: "confirmed",
  });

  const obj = team.toObject();
  obj.memberCount = memberCount;
  return obj;
};

/**
 * Updates team attributes. Restricted to the team captain.
 *
 * @param {string} teamId
 * @param {string} requesterId
 * @param {Object} updates
 */
export const updateTeam = async (teamId, requesterId, updates) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const err = new Error("Team not found");
    err.statusCode = 404;
    throw err;
  }

  if (team.captain.toString() !== requesterId.toString()) {
    const err = new Error("Only the team captain can update team settings");
    err.statusCode = 403;
    throw err;
  }

  if (updates.name) team.name = updates.name;
  if (updates.description !== undefined) team.description = updates.description;
  if (updates.visibility) team.visibility = updates.visibility;
  if (updates.challengeEnabled !== undefined) team.challengeEnabled = updates.challengeEnabled;
  if (updates.status) team.status = updates.status;

  if (updates.preferredPlayingLocation?.coordinates) {
    const [lng, lat] = updates.preferredPlayingLocation.coordinates;
    const h3 = calculateH3Cells(lat, lng);

    team.preferredPlayingLocation = {
      geo: { type: "Point", coordinates: [lng, lat] },
      venueName: updates.preferredPlayingLocation.venueName || team.preferredPlayingLocation.venueName,
      city: updates.preferredPlayingLocation.city || team.preferredPlayingLocation.city,
      state: updates.preferredPlayingLocation.state || team.preferredPlayingLocation.state,
      country: updates.preferredPlayingLocation.country || team.preferredPlayingLocation.country,
    };
    team.h3Cells = { res7: h3.res7, res8: h3.res8 };
  }

  await team.save();
  return team;
};

/**
 * Converts a temporary match team to a permanent team.
 *
 * @param {string} teamId
 * @param {string} captainId
 */
export const convertToPermanent = async (teamId, captainId) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const err = new Error("Team not found");
    err.statusCode = 404;
    throw err;
  }

  if (team.captain.toString() !== captainId.toString()) {
    const err = new Error("Only the team captain can convert the team to permanent");
    err.statusCode = 403;
    throw err;
  }

  team.type = "permanent";
  await team.save();

  return {
    success: true,
    message: "Team successfully converted to permanent",
    team,
  };
};

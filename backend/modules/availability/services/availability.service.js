import { UserProfile } from "../../user/models/userProfile.model.js";
import { getEffectiveAvailability } from "../utils/availabilityCalculator.js";
import { scheduleAvailabilityTransition } from "../jobs/availability.queue.js";

/**
 * Retrieves the full availability state and dynamic effective status for a player.
 *
 * @param {string} authUserId
 */
export const getMyAvailability = async (authUserId) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("User profile not found");
    err.statusCode = 404;
    throw err;
  }

  const effective = getEffectiveAvailability(profile, new Date());

  return {
    isAvailable: effective.isAvailable,
    effectiveStatus: effective.effectiveStatus,
    reason: effective.reason,
    baseStatus: profile.availability?.baseStatus || "offline",
    manualIndefiniteInactive: Boolean(profile.availability?.manualIndefiniteInactive),
    temporaryPauseUntil: profile.availability?.temporaryPauseUntil || null,
    timezone: profile.availability?.timezone || "UTC",
    oneTimeSchedules: profile.availability?.oneTimeSchedules || [],
    recurringSchedules: profile.availability?.recurringSchedules || [],
    scheduleVersion: profile.availability?.scheduleVersion || 0,
    lastUpdatedAt: profile.availability?.updatedAt || profile.updatedAt,
  };
};

/**
 * Updates base availability status and manual inactivity override.
 *
 * @param {string} authUserId
 * @param {Object} updates
 */
export const updateAvailability = async (authUserId, updates) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("User profile not found");
    err.statusCode = 404;
    throw err;
  }

  if (updates.baseStatus !== undefined) {
    profile.availability.baseStatus = updates.baseStatus;
  }
  if (updates.status !== undefined && updates.baseStatus === undefined) {
    profile.availability.baseStatus = updates.status;
  }
  if (updates.manualIndefiniteInactive !== undefined) {
    profile.availability.manualIndefiniteInactive = updates.manualIndefiniteInactive;
  }
  if (updates.timezone !== undefined) {
    profile.availability.timezone = updates.timezone;
  }

  profile.availability.scheduleVersion = (profile.availability.scheduleVersion || 0) + 1;
  const effective = getEffectiveAvailability(profile, new Date());
  profile.availability.status = effective.effectiveStatus;
  profile.availability.updatedAt = new Date();

  await profile.save();
  return await getMyAvailability(authUserId);
};

/**
 * Temporarily pauses availability for a fixed duration in minutes.
 *
 * @param {string} authUserId
 * @param {number} durationMinutes
 */
export const setTemporaryPause = async (authUserId, durationMinutes) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("User profile not found");
    err.statusCode = 404;
    throw err;
  }

  const pauseUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  profile.availability.temporaryPauseUntil = pauseUntil;
  profile.availability.scheduleVersion = (profile.availability.scheduleVersion || 0) + 1;

  const effective = getEffectiveAvailability(profile, new Date());
  profile.availability.status = effective.effectiveStatus;
  profile.availability.updatedAt = new Date();

  await profile.save();

  // Schedule delayed transition via BullMQ to wake up when pause expires
  await scheduleAvailabilityTransition(authUserId, pauseUntil, profile.availability.scheduleVersion);

  return {
    paused: true,
    temporaryPauseUntil: pauseUntil,
    effectiveStatus: effective.effectiveStatus,
    durationMinutes,
  };
};

/**
 * Cancels an active temporary pause immediately.
 *
 * @param {string} authUserId
 */
export const cancelTemporaryPause = async (authUserId) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("User profile not found");
    err.statusCode = 404;
    throw err;
  }

  profile.availability.temporaryPauseUntil = null;
  profile.availability.scheduleVersion = (profile.availability.scheduleVersion || 0) + 1;

  const effective = getEffectiveAvailability(profile, new Date());
  profile.availability.status = effective.effectiveStatus;
  profile.availability.updatedAt = new Date();

  await profile.save();

  return {
    paused: false,
    effectiveStatus: effective.effectiveStatus,
    reason: effective.reason,
  };
};

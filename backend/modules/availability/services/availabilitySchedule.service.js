import { UserProfile } from "../../user/models/userProfile.model.js";
import { getEffectiveAvailability } from "../utils/availabilityCalculator.js";
import { scheduleAvailabilityTransition } from "../jobs/availability.queue.js";

/**
 * Sets or replaces player's scheduled availability (one-time or recurring).
 *
 * @param {string} authUserId
 * @param {Object} scheduleData
 */
export const setSchedule = async (authUserId, scheduleData) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("User profile not found");
    err.statusCode = 404;
    throw err;
  }

  profile.availability.scheduleVersion = (profile.availability.scheduleVersion || 0) + 1;
  const version = profile.availability.scheduleVersion;

  if (scheduleData.timezone) {
    profile.availability.timezone = scheduleData.timezone;
  }

  if (scheduleData.scheduleType === "one_time") {
    profile.availability.oneTimeSchedules = [
      {
        startAt: scheduleData.startAt,
        endAt: scheduleData.endAt,
        status: scheduleData.status || "available",
        note: scheduleData.note || "",
      },
    ];

    // Schedule BullMQ transitions at both startAt and endAt
    if (new Date(scheduleData.startAt) > new Date()) {
      await scheduleAvailabilityTransition(authUserId, scheduleData.startAt, version);
    }
    if (new Date(scheduleData.endAt) > new Date()) {
      await scheduleAvailabilityTransition(authUserId, scheduleData.endAt, version);
    }
  } else if (scheduleData.scheduleType === "recurring") {
    profile.availability.recurringSchedules = [
      {
        daysOfWeek: scheduleData.daysOfWeek,
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        status: scheduleData.status || "available",
      },
    ];
  }

  const effective = getEffectiveAvailability(profile, new Date());
  profile.availability.status = effective.effectiveStatus;
  profile.availability.updatedAt = new Date();

  await profile.save();

  return {
    scheduleType: scheduleData.scheduleType,
    effectiveStatus: effective.effectiveStatus,
    oneTimeSchedules: profile.availability.oneTimeSchedules,
    recurringSchedules: profile.availability.recurringSchedules,
    timezone: profile.availability.timezone,
  };
};

/**
 * Retrieves player's current scheduled availability.
 *
 * @param {string} authUserId
 */
export const getSchedule = async (authUserId) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("User profile not found");
    err.statusCode = 404;
    throw err;
  }

  return {
    timezone: profile.availability?.timezone || "UTC",
    oneTimeSchedules: profile.availability?.oneTimeSchedules || [],
    recurringSchedules: profile.availability?.recurringSchedules || [],
    scheduleVersion: profile.availability?.scheduleVersion || 0,
  };
};

/**
 * Clears player's availability schedules.
 *
 * @param {string} authUserId
 */
export const deleteSchedule = async (authUserId) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("User profile not found");
    err.statusCode = 404;
    throw err;
  }

  profile.availability.oneTimeSchedules = [];
  profile.availability.recurringSchedules = [];
  profile.availability.scheduleVersion = (profile.availability.scheduleVersion || 0) + 1;

  const effective = getEffectiveAvailability(profile, new Date());
  profile.availability.status = effective.effectiveStatus;
  profile.availability.updatedAt = new Date();

  await profile.save();

  return {
    cleared: true,
    effectiveStatus: effective.effectiveStatus,
  };
};

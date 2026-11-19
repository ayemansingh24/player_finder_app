/**
 * availabilityCalculator.js
 *
 * Authoritative business logic for evaluating player effective availability.
 * Follows the 5-tier strict priority hierarchy from Section 62.
 */

/**
 * Calculates effective availability for a player at a specific timestamp.
 *
 * @param {Object} profile - UserProfile document or object containing availability field
 * @param {Date} [atTime=new Date()] - Reference timestamp
 * @returns {{ isAvailable: boolean, effectiveStatus: string, reason: string }}
 */
export const getEffectiveAvailability = (profile, atTime = new Date()) => {
  if (!profile || !profile.availability) {
    return { isAvailable: false, effectiveStatus: "offline", reason: "missing_profile" };
  }

  const {
    baseStatus = "offline",
    manualIndefiniteInactive = false,
    temporaryPauseUntil = null,
    oneTimeSchedules = [],
    recurringSchedules = [],
    timezone = "UTC",
  } = profile.availability;

  const targetDate = atTime instanceof Date ? atTime : new Date(atTime);

  // Priority 1: Manual indefinite inactivity override
  if (manualIndefiniteInactive) {
    return {
      isAvailable: false,
      effectiveStatus: "offline",
      reason: "manual_indefinite_inactive",
    };
  }

  // Priority 2: Temporary pause expiration
  if (temporaryPauseUntil && new Date(temporaryPauseUntil) > targetDate) {
    return {
      isAvailable: false,
      effectiveStatus: "busy",
      reason: "temporary_pause_active",
    };
  }

  // Priority 3: Applicable one-time schedule
  if (Array.isArray(oneTimeSchedules) && oneTimeSchedules.length > 0) {
    const activeOneTime = oneTimeSchedules.find((s) => {
      const start = new Date(s.startAt);
      const end = new Date(s.endAt);
      return targetDate >= start && targetDate <= end;
    });

    if (activeOneTime) {
      return {
        isAvailable: activeOneTime.status === "available",
        effectiveStatus: activeOneTime.status,
        reason: "one_time_schedule",
      };
    }
  }

  // Priority 4: Recurring weekly schedule in player's timezone
  if (Array.isArray(recurringSchedules) && recurringSchedules.length > 0) {
    try {
      // Format target date into local weekday and HH:MM in player's timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone || "UTC",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(targetDate);
      const weekdayStr = parts.find((p) => p.type === "weekday")?.value?.toLowerCase();
      const hourStr = parts.find((p) => p.type === "hour")?.value || "00";
      const minuteStr = parts.find((p) => p.type === "minute")?.value || "00";
      const currentTimeStr = `${hourStr.padStart(2, "0")}:${minuteStr.padStart(2, "0")}`;

      const weekdayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      const currentDay = weekdayMap[weekdayStr?.slice(0, 3)] ?? targetDate.getUTCDay();

      const matchingRecurring = recurringSchedules.find((rec) => {
        if (!rec.daysOfWeek || !rec.daysOfWeek.includes(currentDay)) {
          return false;
        }

        const start = rec.startTime;
        const end = rec.endTime;

        if (!start || !end) return false;

        if (start <= end) {
          // Standard intra-day window, e.g. 18:00 to 22:00
          return currentTimeStr >= start && currentTimeStr <= end;
        } else {
          // Overnight window, e.g. 21:00 to 02:00
          return currentTimeStr >= start || currentTimeStr <= end;
        }
      });

      if (matchingRecurring) {
        return {
          isAvailable: matchingRecurring.status === "available",
          effectiveStatus: matchingRecurring.status,
          reason: "recurring_schedule",
        };
      }
    } catch (tzErr) {
      // If timezone string is invalid, fallback to UTC
      console.warn("Timezone evaluation error:", tzErr.message);
    }
  }

  // Priority 5: Base manual preference
  const isBaseAvailable = baseStatus === "available";
  return {
    isAvailable: isBaseAvailable,
    effectiveStatus: baseStatus,
    reason: "base_preference",
  };
};

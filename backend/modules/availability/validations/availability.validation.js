/**
 * availability.validation.js
 */

const VALID_STATUSES = ["available", "busy", "offline"];

export const validateAvailabilityUpdate = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body must be an object"] };
  }

  if (data.status !== undefined) {
    if (!VALID_STATUSES.includes(data.status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    } else {
      sanitized.status = data.status;
      sanitized.baseStatus = data.status;
    }
  }

  if (data.baseStatus !== undefined) {
    if (!VALID_STATUSES.includes(data.baseStatus)) {
      errors.push(`baseStatus must be one of: ${VALID_STATUSES.join(", ")}`);
    } else {
      sanitized.baseStatus = data.baseStatus;
    }
  }

  if (data.manualIndefiniteInactive !== undefined) {
    if (typeof data.manualIndefiniteInactive !== "boolean") {
      errors.push("manualIndefiniteInactive must be a boolean");
    } else {
      sanitized.manualIndefiniteInactive = data.manualIndefiniteInactive;
    }
  }

  if (data.timezone !== undefined) {
    if (typeof data.timezone !== "string" || !data.timezone.trim()) {
      errors.push("timezone must be a non-empty string");
    } else {
      sanitized.timezone = data.timezone.trim();
    }
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

export const validatePauseInput = (data) => {
  const errors = [];
  const durationMinutes = Number(data?.durationMinutes);

  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    errors.push("durationMinutes must be an integer between 1 and 1440 (up to 24 hours)");
  }

  return {
    isValid: errors.length === 0,
    errors,
    durationMinutes,
  };
};

export const validateScheduleInput = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Payload must be an object"] };
  }

  const { scheduleType, status = "available", startAt, endAt, daysOfWeek, startTime, endTime, timezone = "UTC" } = data;

  if (!scheduleType || !["one_time", "recurring"].includes(scheduleType)) {
    errors.push("scheduleType must be 'one_time' or 'recurring'");
  }
  sanitized.scheduleType = scheduleType;

  if (!VALID_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  sanitized.status = status;
  sanitized.timezone = typeof timezone === "string" ? timezone.trim() : "UTC";

  if (scheduleType === "one_time") {
    if (!startAt || !endAt) {
      errors.push("startAt and endAt dates are required for one_time schedules");
    } else {
      const start = new Date(startAt);
      const end = new Date(endAt);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push("startAt and endAt must be valid date strings");
      } else if (end <= start) {
        errors.push("endAt must be strictly after startAt");
      } else {
        sanitized.startAt = start;
        sanitized.endAt = end;
      }
    }
  }

  if (scheduleType === "recurring") {
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      errors.push("daysOfWeek must be a non-empty array of numbers (0=Sun, ..., 6=Sat)");
    } else {
      const invalidDays = daysOfWeek.filter((d) => !Number.isInteger(d) || d < 0 || d > 6);
      if (invalidDays.length > 0) {
        errors.push("daysOfWeek elements must be integers from 0 to 6");
      } else {
        sanitized.daysOfWeek = Array.from(new Set(daysOfWeek));
      }
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!startTime || !timeRegex.test(startTime) || !endTime || !timeRegex.test(endTime)) {
      errors.push("startTime and endTime must be in 'HH:MM' 24-hour format");
    } else {
      sanitized.startTime = startTime;
      sanitized.endTime = endTime;
    }
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

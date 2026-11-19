export const validateMatchCreate = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body must be an object"] };
  }

  const { sportId, sportSlug, teamA, teamB, matchFormat, scheduledAt, durationMinutes, venue, scorekeeper } = data;

  if (!sportId && !sportSlug) {
    errors.push("sportId or sportSlug is required");
  } else {
    sanitized.sportIdentifier = (sportId || sportSlug).toString().trim();
  }

  if (!matchFormat || typeof matchFormat !== "string") {
    errors.push("matchFormat is required (e.g. '5v5', '11v11', 'T20', 'singles')");
  } else {
    sanitized.matchFormat = matchFormat.trim();
  }

  if (!scheduledAt) {
    errors.push("scheduledAt timestamp is required");
  } else {
    const sched = new Date(scheduledAt);
    if (isNaN(sched.getTime())) {
      errors.push("scheduledAt must be a valid date");
    } else {
      sanitized.scheduledAt = sched;
    }
  }

  sanitized.teamA = teamA || null;
  sanitized.teamB = teamB || null;
  sanitized.durationMinutes = Number(durationMinutes) || 60;
  sanitized.venue = venue || {};
  sanitized.scorekeeper = scorekeeper || null;

  return { isValid: errors.length === 0, errors, sanitized };
};

export const validateMatchSchedule = (data) => {
  const errors = [];
  const { scheduledAt, durationMinutes, venue } = data || {};

  if (!scheduledAt) {
    errors.push("scheduledAt is required to reschedule match");
  } else {
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime())) {
      errors.push("scheduledAt must be a valid date");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      venue: venue || undefined,
    },
  };
};

export const validateMatchEvent = (data) => {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Event payload must be an object"] };
  }

  const { eventType, side, clientEventId } = data;

  if (!eventType || typeof eventType !== "string") {
    errors.push("eventType is required");
  }

  if (!side || !["teamA", "teamB"].includes(side)) {
    errors.push("side must be either 'teamA' or 'teamB'");
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      eventType: eventType?.trim(),
      side,
      player: data.player || null,
      eventData: data.eventData || {},
      clientEventId: clientEventId || null,
    },
  };
};

import { SUPPORTED_SPORTS, EXPERIENCE_LEVELS, AVAILABILITY_STATUSES } from "../../../utils/constants.js";

/**
 * Validates basic profile updates
 */
export const validateProfileUpdate = (data) => {
  const errors = [];
  const sanitized = {};

  // Disallow forbidden/system/security fields
  const forbiddenKeys = [
    "_id",
    "authUser",
    "h3Index",
    "onboardingCompleted",
    "onboardingCompletedAt",
    "ratingsSummary",
    "location",
    "sportsProfiles",
    "createdAt",
    "updatedAt",
  ];

  for (const key of forbiddenKeys) {
    if (data[key] !== undefined) {
      errors.push(`Field '${key}' cannot be modified directly through this endpoint`);
    }
  }

  if (data.displayName !== undefined) {
    if (typeof data.displayName !== "string" || !data.displayName.trim()) {
      errors.push("Display name must be a non-empty string");
    } else if (data.displayName.length > 60) {
      errors.push("Display name cannot exceed 60 characters");
    } else {
      sanitized.displayName = data.displayName.trim();
    }
  }

  if (data.bio !== undefined) {
    if (typeof data.bio !== "string") {
      errors.push("Bio must be a string");
    } else if (data.bio.length > 500) {
      errors.push("Bio cannot exceed 500 characters");
    } else {
      sanitized.bio = data.bio.trim();
    }
  }

  if (data.dateOfBirth !== undefined) {
    if (data.dateOfBirth === null || data.dateOfBirth === "") {
      sanitized.dateOfBirth = null;
    } else {
      const parsedDate = new Date(data.dateOfBirth);
      if (isNaN(parsedDate.getTime())) {
        errors.push("Invalid date of birth format");
      } else if (parsedDate > new Date()) {
        errors.push("Date of birth cannot be in the future");
      } else {
        sanitized.dateOfBirth = parsedDate;
      }
    }
  }

  if (data.preferredLanguage !== undefined) {
    if (typeof data.preferredLanguage !== "string" || !data.preferredLanguage.trim()) {
      errors.push("Preferred language must be a valid string");
    } else {
      sanitized.preferredLanguage = data.preferredLanguage.trim().toLowerCase();
    }
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

/**
 * Validates sports profile batch replacement / update
 */
export const validateSportsInput = (sports) => {
  const errors = [];

  if (!Array.isArray(sports)) {
    return { isValid: false, errors: ["Sports payload must be an array of sport profiles"] };
  }

  const seenSports = new Set();
  let primaryCount = 0;
  const validatedList = [];

  for (let i = 0; i < sports.length; i++) {
    const item = sports[i];
    if (!item || typeof item !== "object") {
      errors.push(`Item at index ${i} is not a valid sport profile object`);
      continue;
    }

    const { sport, experienceLevel, preferredPositions, skills, yearsOfExperience, isPrimarySport } = item;

    if (!sport || typeof sport !== "string") {
      errors.push(`Sport at index ${i} is required and must be a string`);
      continue;
    }

    const normalizedSport = sport.toLowerCase().trim();
    if (!SUPPORTED_SPORTS.includes(normalizedSport)) {
      errors.push(`Sport '${sport}' at index ${i} is not currently supported`);
    }

    if (seenSports.has(normalizedSport)) {
      errors.push(`Duplicate sport '${normalizedSport}' detected in request list`);
    }
    seenSports.add(normalizedSport);

    const level = (experienceLevel || "beginner").toLowerCase().trim();
    if (!EXPERIENCE_LEVELS.includes(level)) {
      errors.push(`Experience level '${experienceLevel}' at index ${i} must be one of: ${EXPERIENCE_LEVELS.join(", ")}`);
    }

    const positions = Array.isArray(preferredPositions)
      ? preferredPositions.filter((p) => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
      : [];

    const skillList = Array.isArray(skills)
      ? skills.filter((s) => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
      : [];

    const years = typeof yearsOfExperience === "number" ? Math.max(0, yearsOfExperience) : 0;
    if (years > 70) {
      errors.push(`Years of experience for ${normalizedSport} cannot exceed 70`);
    }

    const isPrimary = Boolean(isPrimarySport);
    if (isPrimary) {
      primaryCount++;
    }

    validatedList.push({
      sport: normalizedSport,
      experienceLevel: level,
      preferredPositions: positions,
      skills: skillList,
      yearsOfExperience: years,
      isPrimarySport: isPrimary,
    });
  }

  if (primaryCount > 1) {
    errors.push("At most one sport can be designated as primary");
  }

  return { isValid: errors.length === 0, errors, validatedList };
};

/**
 * Validates location updates
 */
export const validateLocationInput = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Location payload is missing or invalid"] };
  }

  const { coordinates, city, state, country, isSharingEnabled } = data;

  if (coordinates !== undefined) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      errors.push("Coordinates must be an array of [longitude, latitude]");
    } else {
      const [lng, lat] = coordinates;
      if (typeof lng !== "number" || typeof lat !== "number") {
        errors.push("Longitude and latitude must both be valid numbers");
      } else if (lng < -180 || lng > 180) {
        errors.push("Longitude must be between -180 and 180");
      } else if (lat < -90 || lat > 90) {
        errors.push("Latitude must be between -90 and 90");
      } else {
        sanitized.coordinates = [lng, lat];
      }
    }
  }

  if (city !== undefined) sanitized.city = String(city).trim();
  if (state !== undefined) sanitized.state = String(state).trim();
  if (country !== undefined) sanitized.country = String(country).trim();
  if (isSharingEnabled !== undefined) sanitized.isSharingEnabled = Boolean(isSharingEnabled);

  return { isValid: errors.length === 0, errors, sanitized };
};

/**
 * Validates availability updates
 */
export const validateAvailabilityInput = (data) => {
  if (!data || !data.status) {
    return { isValid: false, errors: ["Availability 'status' field is required"] };
  }

  const status = String(data.status).toLowerCase().trim();
  if (!AVAILABILITY_STATUSES.includes(status)) {
    return {
      isValid: false,
      errors: [`Availability status must be one of: ${AVAILABILITY_STATUSES.join(", ")}`],
    };
  }

  return { isValid: true, errors: [], status };
};

/**
 * Validates preferences updates
 */
export const validatePreferencesInput = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Preferences payload is missing or invalid"] };
  }

  if (data.searchRadiusKm !== undefined) {
    const radius = Number(data.searchRadiusKm);
    if (isNaN(radius) || radius < 1 || radius > 100) {
      errors.push("Search radius must be a number between 1 and 100 km");
    } else {
      sanitized.searchRadiusKm = radius;
    }
  }

  if (data.notificationsEnabled !== undefined) {
    sanitized.notificationsEnabled = Boolean(data.notificationsEnabled);
  }

  if (data.matchInvitationsEnabled !== undefined) {
    sanitized.matchInvitationsEnabled = Boolean(data.matchInvitationsEnabled);
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

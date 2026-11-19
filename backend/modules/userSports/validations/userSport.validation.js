import { EXPERIENCE_RATING } from "../../../config/sports.config.js";

/**
 * Validates experience level (integer between 1 and 10 inclusive)
 */
export const validateExperienceLevel = (level) => {
  if (level === undefined || level === null) {
    return { isValid: false, error: "experienceLevel is required" };
  }

  if (typeof level !== "number" || !Number.isInteger(level)) {
    return { isValid: false, error: "experienceLevel must be an integer between 1 and 10" };
  }

  if (level < EXPERIENCE_RATING.MIN || level > EXPERIENCE_RATING.MAX) {
    return {
      isValid: false,
      error: `experienceLevel must be between ${EXPERIENCE_RATING.MIN} and ${EXPERIENCE_RATING.MAX}`,
    };
  }

  return { isValid: true, value: level };
};

/**
 * Validates preferred positions against the authoritative Sport document
 */
export const validatePositionsForSport = (positions, sportDoc) => {
  if (!sportDoc) {
    return { isValid: false, errors: ["Sport document is missing for validation"] };
  }

  // Rule 1: Sport has NO positions (e.g. Badminton, Chess, Pickleball)
  if (!sportDoc.hasPositions) {
    if (positions !== undefined && positions !== null) {
      if (!Array.isArray(positions) || positions.length > 0) {
        return {
          isValid: false,
          errors: [`Sport '${sportDoc.name}' does not support positions. 'preferredPositions' must be empty.`],
        };
      }
    }
    return { isValid: true, sanitizedPositions: [] };
  }

  // Rule 2: Sport HAS positions
  if (positions === undefined || positions === null) {
    // If sport has positions but none sent, default to ['not_sure']
    return { isValid: true, sanitizedPositions: ["not_sure"] };
  }

  if (!Array.isArray(positions)) {
    return { isValid: false, errors: ["preferredPositions must be an array of position strings"] };
  }

  const validValues = sportDoc.positions.map((p) => p.value);
  const errors = [];
  const normalized = [];

  for (const pos of positions) {
    if (typeof pos !== "string" || !pos.trim()) {
      errors.push("Position values must be non-empty strings");
      continue;
    }

    const val = pos.toLowerCase().trim();
    if (!validValues.includes(val)) {
      errors.push(`'${pos}' is not a valid position for ${sportDoc.name}. Valid positions: ${validValues.join(", ")}`);
    } else if (!normalized.includes(val)) {
      normalized.push(val);
    }
  }

  // Rule 3: 'not_sure' exclusivity rule
  if (normalized.includes("not_sure") && normalized.length > 1) {
    errors.push("'not_sure' (Beginner / Not Sure Yet) cannot be selected alongside specific playing positions.");
  }

  // If array was empty for a sport that has positions, default to 'not_sure'
  if (normalized.length === 0 && errors.length === 0) {
    normalized.push("not_sure");
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedPositions: normalized,
  };
};

/**
 * Validates full UserSport registration payload
 */
export const validateUserSportInput = (data, sportDoc, isPatch = false) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Payload must be an object"] };
  }

  // Experience level validation
  if (!isPatch || data.experienceLevel !== undefined) {
    const expValidation = validateExperienceLevel(data.experienceLevel);
    if (!expValidation.isValid) {
      errors.push(expValidation.error);
    } else {
      sanitized.experienceLevel = expValidation.value;
    }
  }

  // Positions validation
  if (!isPatch || data.preferredPositions !== undefined) {
    const posValidation = validatePositionsForSport(data.preferredPositions, sportDoc);
    if (!posValidation.isValid) {
      errors.push(...posValidation.errors);
    } else {
      sanitized.preferredPositions = posValidation.sanitizedPositions;
    }
  }

  // Primary sport flag validation
  if (data.isPrimarySport !== undefined) {
    sanitized.isPrimarySport = Boolean(data.isPrimarySport);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

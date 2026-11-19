import { validateGeoCoordinates } from "../../../utils/geo.utils.js";
import { H3_CONFIG } from "../../../config/h3.config.js";

export const validatePlayerDiscoveryInput = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request payload must be an object"] };
  }

  const { sport, position, searchLocation, filters = {}, autoExpandRadius = false, page = 1, limit = 20 } = data;

  if (!sport || typeof sport !== "string" || !sport.trim()) {
    errors.push("sport is required (e.g. 'football', 'cricket')");
  } else {
    sanitized.sport = sport.toLowerCase().trim();
  }

  if (position !== undefined && position !== null) {
    if (typeof position !== "string" || !position.trim()) {
      errors.push("position must be a non-empty string or 'any'");
    } else {
      sanitized.position = position.toLowerCase().trim();
    }
  } else {
    sanitized.position = "any";
  }

  if (!searchLocation || typeof searchLocation !== "object") {
    errors.push("searchLocation object is required");
  } else {
    const coords = searchLocation.coordinates;
    const geoCheck = validateGeoCoordinates(coords);
    if (!geoCheck.isValid) {
      errors.push(`searchLocation: ${geoCheck.error}`);
    } else {
      sanitized.searchLocation = {
        type: "Point",
        coordinates: coords,
      };
    }
  }

  // Sanitize filters
  sanitized.filters = {};

  if (filters.maxDistanceKm !== undefined) {
    const dist = Number(filters.maxDistanceKm);
    if (isNaN(dist) || dist < H3_CONFIG.minSearchRadiusKm || dist > H3_CONFIG.maxSearchRadiusKm) {
      errors.push(`filters.maxDistanceKm must be between ${H3_CONFIG.minSearchRadiusKm} and ${H3_CONFIG.maxSearchRadiusKm} km`);
    } else {
      sanitized.filters.maxDistanceKm = dist;
    }
  } else {
    sanitized.filters.maxDistanceKm = H3_CONFIG.defaultSearchRadiusKm;
  }

  if (filters.minExperience !== undefined) {
    const exp = Number(filters.minExperience);
    if (!Number.isInteger(exp) || exp < 1 || exp > 10) {
      errors.push("filters.minExperience must be an integer between 1 and 10");
    } else {
      sanitized.filters.minExperience = exp;
    }
  }

  if (filters.ageMin !== undefined) {
    const aMin = Number(filters.ageMin);
    if (!Number.isInteger(aMin) || aMin < 10 || aMin > 100) {
      errors.push("filters.ageMin must be an integer between 10 and 100");
    } else {
      sanitized.filters.ageMin = aMin;
    }
  }

  if (filters.ageMax !== undefined) {
    const aMax = Number(filters.ageMax);
    if (!Number.isInteger(aMax) || aMax < 10 || aMax > 100) {
      errors.push("filters.ageMax must be an integer between 10 and 100");
    } else {
      sanitized.filters.ageMax = aMax;
    }
  }

  if (sanitized.filters.ageMin && sanitized.filters.ageMax && sanitized.filters.ageMax < sanitized.filters.ageMin) {
    errors.push("filters.ageMax must be greater than or equal to filters.ageMin");
  }

  if (filters.gender !== undefined) {
    const g = String(filters.gender).toLowerCase().trim();
    if (!["male", "female", "other", "any"].includes(g)) {
      errors.push("filters.gender must be 'male', 'female', 'other', or 'any'");
    } else if (g !== "any") {
      sanitized.filters.gender = g;
    }
  }

  if (filters.minRating !== undefined) {
    // Section 27: Rating Module will be implemented later. When requested, flag unsupported.
    errors.push("Verified star ratings are not yet active on the platform. Please omit minRating filter.");
  }

  sanitized.autoExpandRadius = Boolean(autoExpandRadius);
  sanitized.page = Math.max(1, parseInt(page) || 1);
  sanitized.limit = Math.min(50, Math.max(1, parseInt(limit) || 20));

  return { isValid: errors.length === 0, errors, sanitized };
};

export const validateTeamDiscoveryInput = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request payload must be an object"] };
  }

  const { sport, matchFormat, searchLocation, maxDistanceKm = 10, page = 1, limit = 20 } = data;

  if (!sport || typeof sport !== "string" || !sport.trim()) {
    errors.push("sport is required");
  } else {
    sanitized.sport = sport.toLowerCase().trim();
  }

  if (matchFormat) {
    sanitized.matchFormat = String(matchFormat).trim();
  }

  if (!searchLocation || typeof searchLocation !== "object") {
    errors.push("searchLocation object is required");
  } else {
    const coords = searchLocation.coordinates;
    const geoCheck = validateGeoCoordinates(coords);
    if (!geoCheck.isValid) {
      errors.push(`searchLocation: ${geoCheck.error}`);
    } else {
      sanitized.searchLocation = {
        type: "Point",
        coordinates: coords,
      };
    }
  }

  const dist = Number(maxDistanceKm);
  if (isNaN(dist) || dist < 1 || dist > 20) {
    errors.push("maxDistanceKm must be between 1 and 20 km");
  } else {
    sanitized.maxDistanceKm = dist;
  }

  sanitized.page = Math.max(1, parseInt(page) || 1);
  sanitized.limit = Math.min(50, Math.max(1, parseInt(limit) || 20));

  return { isValid: errors.length === 0, errors, sanitized };
};

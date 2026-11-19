import { validateGeoCoordinates } from "../../../utils/geo.utils.js";

export const validateTeamCreate = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body must be an object"] };
  }

  const { name, sportSlug, sportId, description, type, preferredPlayingLocation, matchFormats, visibility, challengeEnabled } = data;

  if (!name || typeof name !== "string" || !name.trim()) {
    errors.push("Team name is required");
  } else if (name.trim().length > 60) {
    errors.push("Team name cannot exceed 60 characters");
  } else {
    sanitized.name = name.trim();
  }

  if (!sportSlug && !sportId) {
    errors.push("sportSlug or sportId is required");
  } else {
    sanitized.sportIdentifier = (sportSlug || sportId).toString().trim();
  }

  if (description !== undefined) {
    sanitized.description = typeof description === "string" ? description.trim() : "";
  }

  if (type !== undefined) {
    if (!["temporary", "permanent"].includes(type)) {
      errors.push("type must be either 'temporary' or 'permanent'");
    } else {
      sanitized.type = type;
    }
  }

  if (visibility !== undefined) {
    if (!["public", "private"].includes(visibility)) {
      errors.push("visibility must be either 'public' or 'private'");
    } else {
      sanitized.visibility = visibility;
    }
  }

  if (challengeEnabled !== undefined) {
    sanitized.challengeEnabled = Boolean(challengeEnabled);
  }

  if (Array.isArray(matchFormats)) {
    sanitized.matchFormats = matchFormats.map((f) => String(f).trim()).filter(Boolean);
  }

  // Validate playing location
  if (!preferredPlayingLocation || typeof preferredPlayingLocation !== "object") {
    errors.push("preferredPlayingLocation object is required");
  } else {
    const coords = preferredPlayingLocation.coordinates;
    const geoCheck = validateGeoCoordinates(coords);
    if (!geoCheck.isValid) {
      errors.push(`preferredPlayingLocation: ${geoCheck.error}`);
    } else {
      sanitized.preferredPlayingLocation = {
        coordinates: coords,
        venueName: preferredPlayingLocation.venueName?.trim() || "",
        city: preferredPlayingLocation.city?.trim() || "",
        state: preferredPlayingLocation.state?.trim() || "",
        country: preferredPlayingLocation.country?.trim() || "",
      };
    }
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

export const validateTeamUpdate = (data) => {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== "object") {
    return { isValid: false, errors: ["Request body must be an object"] };
  }

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      errors.push("Team name cannot be empty");
    } else {
      sanitized.name = data.name.trim();
    }
  }

  if (data.description !== undefined) {
    sanitized.description = typeof data.description === "string" ? data.description.trim() : "";
  }

  if (data.challengeEnabled !== undefined) {
    sanitized.challengeEnabled = Boolean(data.challengeEnabled);
  }

  if (data.visibility !== undefined) {
    if (!["public", "private"].includes(data.visibility)) {
      errors.push("visibility must be 'public' or 'private'");
    } else {
      sanitized.visibility = data.visibility;
    }
  }

  if (data.status !== undefined) {
    if (!["active", "inactive", "disbanded"].includes(data.status)) {
      errors.push("status must be active, inactive, or disbanded");
    } else {
      sanitized.status = data.status;
    }
  }

  if (data.preferredPlayingLocation) {
    const coords = data.preferredPlayingLocation.coordinates;
    if (coords) {
      const geoCheck = validateGeoCoordinates(coords);
      if (!geoCheck.isValid) {
        errors.push(`preferredPlayingLocation: ${geoCheck.error}`);
      } else {
        sanitized.preferredPlayingLocation = {
          coordinates: coords,
          venueName: data.preferredPlayingLocation.venueName?.trim() || "",
          city: data.preferredPlayingLocation.city?.trim() || "",
          state: data.preferredPlayingLocation.state?.trim() || "",
          country: data.preferredPlayingLocation.country?.trim() || "",
        };
      }
    }
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

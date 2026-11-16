import * as userService from "../services/user.service.js";
import {
  validateProfileUpdate,
  validateSportsInput,
  validateLocationInput,
  validateAvailabilityInput,
  validatePreferencesInput,
} from "../validations/user.validation.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

/**
 * GET /api/v1/users/me
 * Retrieves current player's complete private profile
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const profile = await userService.getMyProfile(req.user._id);
    return successResponse(res, "Player profile retrieved successfully", profile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/me
 * Updates basic permitted profile fields (displayName, bio, dateOfBirth, preferredLanguage)
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateProfileUpdate(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const updatedProfile = await userService.updateProfile(req.user._id, sanitized);
    return successResponse(res, "Profile updated successfully", updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/users/me/sports
 * Batch updates or registers player sports
 */
export const updateSports = async (req, res, next) => {
  try {
    const { isValid, errors, validatedList } = validateSportsInput(req.body.sports || req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const updatedProfile = await userService.updateSports(req.user._id, validatedList);
    return successResponse(res, "Sports profile updated successfully", updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/users/me/sports/:sport
 * Removes a specific sport registration
 */
export const removeSport = async (req, res, next) => {
  try {
    const { sport } = req.params;
    if (!sport) {
      return errorResponse(res, "Sport parameter is required", HTTP_STATUS.BAD_REQUEST);
    }

    const updatedProfile = await userService.removeSport(req.user._id, sport);
    return successResponse(res, `Sport '${sport}' removed successfully`, updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/me/location
 * Updates GPS location and triggers backend H3 calculation
 */
export const updateLocation = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateLocationInput(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const updatedProfile = await userService.updateLocation(req.user._id, sanitized);
    return successResponse(res, "Location updated successfully", updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/me/availability
 * Updates player availability status
 */
export const updateAvailability = async (req, res, next) => {
  try {
    const { isValid, errors, status } = validateAvailabilityInput(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const updatedProfile = await userService.updateAvailability(req.user._id, status);
    return successResponse(res, "Availability updated successfully", updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/me/preferences
 * Updates player preferences
 */
export const updatePreferences = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validatePreferencesInput(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const updatedProfile = await userService.updatePreferences(req.user._id, sanitized);
    return successResponse(res, "Preferences updated successfully", updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/users/me/avatar
 * Uploads player avatar image via Multer and Cloudinary
 */
export const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, "No image file provided", HTTP_STATUS.BAD_REQUEST);
    }

    const updatedProfile = await userService.updateAvatar(req.user._id, req.file);
    return successResponse(res, "Avatar uploaded successfully", updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/users/me/fcm-token
 * Registers an FCM push notification device token
 */
export const registerFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return errorResponse(res, "FCM token is required", HTTP_STATUS.BAD_REQUEST);
    }

    const updatedProfile = await userService.registerFcmToken(req.user._id, token);
    return successResponse(res, "FCM token registered successfully", updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/users/me/fcm-token
 * Removes an FCM push notification device token
 */
export const removeFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return errorResponse(res, "FCM token is required", HTTP_STATUS.BAD_REQUEST);
    }

    const updatedProfile = await userService.removeFcmToken(req.user._id, token);
    return successResponse(res, "FCM token removed successfully", updatedProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/users/:userId
 * Retrieves safe public profile of another player
 */
export const getPublicProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return errorResponse(res, "User ID is required", HTTP_STATUS.BAD_REQUEST);
    }

    const publicProfile = await userService.getPublicProfile(userId);
    return successResponse(res, "Public profile retrieved successfully", publicProfile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

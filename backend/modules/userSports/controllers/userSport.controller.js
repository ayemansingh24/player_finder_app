import * as userSportService from "../services/userSport.service.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

/**
 * GET /api/v1/users/me/sports
 * Retrieves all registered sports for the logged-in player
 */
export const getMySports = async (req, res, next) => {
  try {
    const sports = await userSportService.getUserSports(req.user._id);
    return successResponse(res, "Registered sports retrieved successfully", sports, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/users/me/sports
 * Adds a new sport registration for the logged-in player
 */
export const addSport = async (req, res, next) => {
  try {
    const sportIdentifier = req.body.sport || req.body.sportSlug || req.body.slug;
    if (!sportIdentifier) {
      return errorResponse(res, "Field 'sport' (slug or ID) is required", HTTP_STATUS.BAD_REQUEST);
    }

    const created = await userSportService.addUserSport(req.user._id, sportIdentifier, req.body);
    return successResponse(res, "Sport registered successfully", created, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/users/me/sports/:sportSlug
 * Updates positions, experience level, or primary flag for a registered sport
 */
export const updateSport = async (req, res, next) => {
  try {
    const { sportSlug } = req.params;
    const updated = await userSportService.updateUserSport(req.user._id, sportSlug, req.body);
    return successResponse(res, "Sport registration updated successfully", updated, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/users/me/sports/:sportSlug
 * Removes a registered sport for the logged-in player
 */
export const deleteSport = async (req, res, next) => {
  try {
    const { sportSlug } = req.params;
    const result = await userSportService.deleteUserSport(req.user._id, sportSlug);
    return successResponse(res, `Sport '${result.deletedSport}' removed successfully`, result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

import * as sportService from "../services/sport.service.js";
import { successResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

/**
 * GET /api/v1/sports
 * Returns authoritative sports catalogue
 */
export const getAllSports = async (req, res, next) => {
  try {
    const sports = await sportService.getAllSports(true);
    return successResponse(res, "Sports catalogue retrieved successfully", sports, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/sports/:slug
 * Returns sport by unique slug
 */
export const getSportBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const sport = await sportService.getSportBySlug(slug);
    return successResponse(res, "Sport retrieved successfully", sport, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

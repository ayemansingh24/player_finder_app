import * as scoringService from "../services/matchScoring.service.js";
import { validateMatchEvent } from "../validations/match.validation.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

export const recordEvent = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateMatchEvent(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const result = await scoringService.recordEvent(req.params.matchId, req.user._id, sanitized);
    return successResponse(res, "Event recorded successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const getLiveScore = async (req, res, next) => {
  try {
    const score = await scoringService.getLiveScore(req.params.matchId);
    return successResponse(res, "Live score retrieved successfully", score, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

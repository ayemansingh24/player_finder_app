import * as recruitmentService from "../services/recruitment.service.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

export const createRecruitment = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { requiredPlayerCount, preferredPositions, scheduledAt, durationMinutes, playingLocation } = req.body;

    if (!requiredPlayerCount || requiredPlayerCount < 1) {
      return errorResponse(res, "requiredPlayerCount must be at least 1", HTTP_STATUS.BAD_REQUEST);
    }

    const recruitment = await recruitmentService.createRecruitment(teamId, req.user._id, {
      requiredPlayerCount,
      preferredPositions,
      scheduledAt,
      durationMinutes,
      playingLocation,
    });

    return successResponse(res, "Recruitment request created successfully", recruitment, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

export const getTeamRecruitments = async (req, res, next) => {
  try {
    const requests = await recruitmentService.getTeamRecruitments(req.params.teamId);
    return successResponse(res, "Recruitment requests retrieved successfully", requests, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const updateRecruitment = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const updated = await recruitmentService.updateRecruitment(requestId, req.user._id, req.body);
    return successResponse(res, "Recruitment request updated successfully", updated, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

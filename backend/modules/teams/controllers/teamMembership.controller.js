import * as membershipService from "../services/teamMembership.service.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

export const getTeamMembers = async (req, res, next) => {
  try {
    const members = await membershipService.getTeamMembers(req.params.teamId);
    return successResponse(res, "Team members retrieved successfully", members, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;
    const result = await membershipService.removeMember(teamId, userId, req.user._id);
    return successResponse(res, "Member removed successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const transferCaptain = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { newCaptainId } = req.body;

    if (!newCaptainId) {
      return errorResponse(res, "newCaptainId is required", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await membershipService.transferCaptain(teamId, req.user._id, newCaptainId);
    return successResponse(res, "Captaincy transferred successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

import * as teamService from "../services/team.service.js";
import * as eligibilityService from "../services/teamEligibility.service.js";
import { validateTeamCreate, validateTeamUpdate } from "../validations/team.validation.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

export const createTeam = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateTeamCreate(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const team = await teamService.createTeam(req.user._id, sanitized);
    return successResponse(res, "Team created successfully", team, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

export const getMyTeams = async (req, res, next) => {
  try {
    const teams = await teamService.getMyTeams(req.user._id);
    return successResponse(res, "My teams retrieved successfully", teams, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const getTeamById = async (req, res, next) => {
  try {
    const team = await teamService.getTeamById(req.params.teamId);
    return successResponse(res, "Team retrieved successfully", team, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const updateTeam = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateTeamUpdate(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const team = await teamService.updateTeam(req.params.teamId, req.user._id, sanitized);
    return successResponse(res, "Team updated successfully", team, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const convertToPermanent = async (req, res, next) => {
  try {
    const result = await teamService.convertToPermanent(req.params.teamId, req.user._id);
    return successResponse(res, result.message, result.team, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const checkTeamEligibility = async (req, res, next) => {
  try {
    const { playerUserIds, requiredSportId, requiredLineupSize } = req.body;
    const result = await eligibilityService.validateLineupEligibility(
      req.params.teamId,
      playerUserIds,
      requiredSportId,
      requiredLineupSize
    );

    return successResponse(res, "Eligibility evaluated", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

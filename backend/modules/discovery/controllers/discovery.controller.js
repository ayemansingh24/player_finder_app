import * as playerDiscoveryService from "../services/playerDiscovery.service.js";
import * as teamDiscoveryService from "../services/teamDiscovery.service.js";
import { validatePlayerDiscoveryInput, validateTeamDiscoveryInput } from "../validations/discovery.validation.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

export const searchPlayers = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validatePlayerDiscoveryInput(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const data = await playerDiscoveryService.searchPlayers(req.user._id, sanitized);
    return successResponse(res, "Players discovered successfully", data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const searchTeams = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateTeamDiscoveryInput(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const data = await teamDiscoveryService.searchTeams(req.user._id, sanitized);
    return successResponse(res, "Opponent teams discovered successfully", data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

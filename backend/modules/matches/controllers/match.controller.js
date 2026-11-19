import * as matchService from "../services/match.service.js";
import * as lifecycleService from "../services/matchLifecycle.service.js";
import * as verificationService from "../services/matchVerification.service.js";
import { validateMatchCreate, validateMatchSchedule } from "../validations/match.validation.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

export const createMatch = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateMatchCreate(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const match = await matchService.createMatch(req.user._id, sanitized);
    return successResponse(res, "Match created successfully", match, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

export const getMyMatches = async (req, res, next) => {
  try {
    const matches = await matchService.getMyMatches(req.user._id);
    return successResponse(res, "Matches retrieved successfully", matches, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const getMatchById = async (req, res, next) => {
  try {
    const match = await matchService.getMatchById(req.params.matchId);
    return successResponse(res, "Match retrieved successfully", match, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const scheduleMatch = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateMatchSchedule(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const match = await matchService.scheduleMatch(req.params.matchId, req.user._id, sanitized);
    return successResponse(res, "Match rescheduled successfully", match, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const startMatch = async (req, res, next) => {
  try {
    const match = await lifecycleService.startMatch(req.params.matchId, req.user._id);
    return successResponse(res, "Match is now live", match, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const endMatch = async (req, res, next) => {
  try {
    const match = await lifecycleService.endMatch(req.params.matchId, req.user._id);
    return successResponse(res, "Match ended and pending verification", match, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const confirmResult = async (req, res, next) => {
  try {
    const result = await verificationService.confirmResult(req.params.matchId, req.user._id);
    return successResponse(res, "Result confirmation recorded", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const disputeResult = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await verificationService.disputeResult(req.params.matchId, req.user._id, reason);
    return successResponse(res, "Match result marked as disputed", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const resolveDispute = async (req, res, next) => {
  try {
    const { resolution, overrideResult } = req.body;
    const result = await verificationService.resolveDispute(
      req.params.matchId,
      req.user._id,
      resolution,
      overrideResult
    );
    return successResponse(res, "Dispute resolved successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

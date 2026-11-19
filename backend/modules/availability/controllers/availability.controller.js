import * as availabilityService from "../services/availability.service.js";
import * as scheduleService from "../services/availabilitySchedule.service.js";
import {
  validateAvailabilityUpdate,
  validatePauseInput,
  validateScheduleInput,
} from "../validations/availability.validation.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

export const getMyAvailability = async (req, res, next) => {
  try {
    const data = await availabilityService.getMyAvailability(req.user._id);
    return successResponse(res, "Availability retrieved successfully", data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const updateAvailability = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateAvailabilityUpdate(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const data = await availabilityService.updateAvailability(req.user._id, sanitized);
    return successResponse(res, "Availability updated successfully", data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const setPause = async (req, res, next) => {
  try {
    const { isValid, errors, durationMinutes } = validatePauseInput(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const data = await availabilityService.setTemporaryPause(req.user._id, durationMinutes);
    return successResponse(res, `Availability paused for ${durationMinutes} minutes`, data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const cancelPause = async (req, res, next) => {
  try {
    const data = await availabilityService.cancelTemporaryPause(req.user._id);
    return successResponse(res, "Availability pause cancelled", data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const setSchedule = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateScheduleInput(req.body);
    if (!isValid) {
      return errorResponse(res, "Validation failed", HTTP_STATUS.BAD_REQUEST, errors);
    }

    const data = await scheduleService.setSchedule(req.user._id, sanitized);
    return successResponse(res, "Availability schedule saved successfully", data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const getSchedule = async (req, res, next) => {
  try {
    const data = await scheduleService.getSchedule(req.user._id);
    return successResponse(res, "Availability schedule retrieved successfully", data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const deleteSchedule = async (req, res, next) => {
  try {
    const data = await scheduleService.deleteSchedule(req.user._id);
    return successResponse(res, "Availability schedule cleared", data, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

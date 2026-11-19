import * as invitationService from "../services/invitation.service.js";
import * as responseService from "../services/invitationResponse.service.js";
import { validateInvitationCreate, validateInvitationFilters } from "../validations/invitation.validation.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

export const createInvitation = async (req, res, next) => {
  try {
    const { valid, error } = validateInvitationCreate(req.body);
    if (!valid) {
      return errorResponse(res, error, HTTP_STATUS.BAD_REQUEST);
    }

    const invitation = await invitationService.createInvitation(req.user._id, req.body);
    return successResponse(res, "Invitation sent successfully", invitation, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

export const getReceivedInvitations = async (req, res, next) => {
  try {
    const { valid, error, filters } = validateInvitationFilters(req.query);
    if (!valid) {
      return errorResponse(res, error, HTTP_STATUS.BAD_REQUEST);
    }

    const result = await invitationService.getReceivedInvitations(req.user._id, filters);
    return successResponse(res, "Received invitations retrieved successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const getSentInvitations = async (req, res, next) => {
  try {
    const { valid, error, filters } = validateInvitationFilters(req.query);
    if (!valid) {
      return errorResponse(res, error, HTTP_STATUS.BAD_REQUEST);
    }

    const result = await invitationService.getSentInvitations(req.user._id, filters);
    return successResponse(res, "Sent invitations retrieved successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const getInvitationById = async (req, res, next) => {
  try {
    const invitation = await invitationService.getInvitationById(req.params.id, req.user._id);
    return successResponse(res, "Invitation details retrieved successfully", invitation, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const acceptInvitation = async (req, res, next) => {
  try {
    const result = await responseService.acceptInvitation(req.params.id, req.user._id);
    return successResponse(res, "Invitation accepted successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const rejectInvitation = async (req, res, next) => {
  try {
    const result = await responseService.rejectInvitation(req.params.id, req.user._id, req.body?.reason);
    return successResponse(res, "Invitation rejected", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

export const cancelInvitation = async (req, res, next) => {
  try {
    const result = await responseService.cancelInvitation(req.params.id, req.user._id);
    return successResponse(res, "Invitation cancelled", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

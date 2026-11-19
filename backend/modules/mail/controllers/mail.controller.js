import * as mailService from "../services/mail.service.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

/**
 * POST /api/v1/mail/reset-link
 * Dispatches official Firebase password reset link
 */
export const sendPasswordResetLink = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, "Recipient 'email' is required", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await mailService.sendFirebasePasswordResetEmail(email);
    return successResponse(res, "Firebase password reset email dispatched", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/mail/verification-link
 * Dispatches official Firebase email verification link
 */
export const sendVerificationLink = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, "Recipient 'email' is required", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await mailService.sendFirebaseEmailVerification(email);
    return successResponse(res, "Firebase email verification link dispatched", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/mail/signin-link
 * Dispatches official Firebase passwordless sign-in magic link
 */
export const sendSignInLink = async (req, res, next) => {
  try {
    const { email, continueUrl } = req.body;
    if (!email) {
      return errorResponse(res, "Recipient 'email' is required", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await mailService.sendFirebaseSignInLink(email, continueUrl);
    return successResponse(res, "Firebase passwordless sign-in link dispatched", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

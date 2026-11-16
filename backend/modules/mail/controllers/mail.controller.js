import * as mailService from "../services/mail.service.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

/**
 * POST /api/v1/mail/test
 * Sends a test email to verify mail delivery pipeline
 */
export const sendTestEmail = async (req, res, next) => {
  try {
    const { to, subject, message } = req.body;
    if (!to) {
      return errorResponse(res, "Recipient 'to' email address is required", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await mailService.sendCustomEmail({
      to,
      subject: subject || "Test Email from Sports Platform",
      text: message || "This is a test email sent from the Sports Matchmaking platform backend.",
      html: `<p>${message || "This is a test email sent from the Sports Matchmaking platform backend."}</p>`,
    });

    return successResponse(res, "Test email processed successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

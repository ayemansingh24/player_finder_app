import * as notificationService from "../services/notification.service.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { HTTP_STATUS } from "../../../utils/constants.js";

/**
 * POST /api/v1/notifications/test
 * Sends a test push notification to a device token or topic
 */
export const sendTestNotification = async (req, res, next) => {
  try {
    const { token, topic, title, body, data } = req.body;

    if (!token && !topic) {
      return errorResponse(res, "Either 'token' or 'topic' is required", HTTP_STATUS.BAD_REQUEST);
    }

    let result;
    if (token) {
      result = await notificationService.sendToDevice(token, {
        title: title || "Test Sports Notification",
        body: body || "This is a test notification from the Sports Platform backend.",
        data: data || { type: "test" },
      });
    } else {
      result = await notificationService.sendToTopic(topic, {
        title: title || "Test Topic Notification",
        body: body || `This is a test notification sent to topic '${topic}'.`,
        data: data || { type: "test_topic" },
      });
    }

    return successResponse(res, "Notification dispatched successfully", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/notifications/user-alert
 * Dispatches a push notification to a specific player
 */
export const sendUserAlert = async (req, res, next) => {
  try {
    const { userId, title, body, data } = req.body;
    if (!userId || !title || !body) {
      return errorResponse(res, "userId, title, and body are required", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await notificationService.sendNotificationToUser(userId, { title, body, data });
    return successResponse(res, "User notification processed", result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

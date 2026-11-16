import admin from "../../../config/firebase.js";
import { UserProfile } from "../../user/models/userProfile.model.js";

/**
 * Notification Module Service (Firebase Cloud Messaging - FCM)
 */

/**
 * Sends a push notification to a specific device token
 */
export const sendToDevice = async (fcmToken, { title, body, data = {}, imageUrl = null }) => {
  if (!fcmToken) {
    throw new Error("Target FCM token is required");
  }

  const sanitizedData = {};
  for (const [k, v] of Object.entries(data)) {
    sanitizedData[k] = typeof v === "string" ? v : JSON.stringify(v);
  }

  const message = {
    token: fcmToken,
    notification: {
      title,
      body,
      ...(imageUrl ? { imageUrl } : {}),
    },
    data: sanitizedData,
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "sports_notifications",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`✅ FCM notification delivered: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("❌ Failed to send FCM notification:", error.message);
    throw error;
  }
};

/**
 * Sends notifications to multiple device tokens (multicast)
 */
export const sendToMultipleDevices = async (fcmTokens, { title, body, data = {}, imageUrl = null }) => {
  if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const uniqueTokens = [...new Set(fcmTokens.filter((t) => typeof t === "string" && t.trim().length > 0))];
  if (uniqueTokens.length === 0) return { successCount: 0, failureCount: 0 };

  const sanitizedData = {};
  for (const [k, v] of Object.entries(data)) {
    sanitizedData[k] = typeof v === "string" ? v : JSON.stringify(v);
  }

  const message = {
    tokens: uniqueTokens,
    notification: {
      title,
      body,
      ...(imageUrl ? { imageUrl } : {}),
    },
    data: sanitizedData,
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "sports_notifications",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ FCM Multicast: ${response.successCount} succeeded, ${response.failureCount} failed.`);
    return response;
  } catch (error) {
    console.error("❌ Multicast FCM error:", error.message);
    throw error;
  }
};

/**
 * Sends a notification to a topic (e.g. 'cricket_invites')
 */
export const sendToTopic = async (topic, { title, body, data = {}, imageUrl = null }) => {
  if (!topic) throw new Error("Topic name is required");

  const sanitizedData = {};
  for (const [k, v] of Object.entries(data)) {
    sanitizedData[k] = typeof v === "string" ? v : JSON.stringify(v);
  }

  const message = {
    topic: topic.replace(/^\/topics\//, ""),
    notification: {
      title,
      body,
      ...(imageUrl ? { imageUrl } : {}),
    },
    data: sanitizedData,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`✅ FCM Topic message sent to '${topic}': ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`❌ FCM Topic error on '${topic}':`, error.message);
    throw error;
  }
};

/**
 * Subscribe tokens to topic
 */
export const subscribeToTopic = async (tokens, topic) => {
  const tokenList = Array.isArray(tokens) ? tokens : [tokens];
  return await admin.messaging().subscribeToTopic(tokenList, topic);
};

/**
 * Unsubscribe tokens from topic
 */
export const unsubscribeFromTopic = async (tokens, topic) => {
  const tokenList = Array.isArray(tokens) ? tokens : [tokens];
  return await admin.messaging().unsubscribeFromTopic(tokenList, topic);
};

/**
 * Sends a push notification to a registered player's profile by their user ID.
 * Respects preferences.notificationsEnabled.
 */
export const sendNotificationToUser = async (userId, { title, body, data = {} }) => {
  const profile = await UserProfile.findOne({
    $or: [{ authUser: userId }, { _id: userId }],
  });

  if (!profile) {
    const err = new Error(`Player profile not found for ID: ${userId}`);
    err.statusCode = 404;
    throw err;
  }

  if (profile.preferences && profile.preferences.notificationsEnabled === false) {
    return { success: false, reason: "notifications_disabled_by_user" };
  }

  const tokens = profile.fcmTokens || [];
  if (tokens.length === 0) {
    return { success: false, reason: "no_active_fcm_tokens" };
  }

  return await sendToMultipleDevices(tokens, { title, body, data });
};

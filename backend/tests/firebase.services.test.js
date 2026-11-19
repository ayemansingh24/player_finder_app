import { jest } from "@jest/globals";
import admin from "../config/firebase.js";
import {
  sendToDevice,
  sendToMultipleDevices,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
} from "../modules/notification/services/notification.service.js";
import {
  sendFirebasePasswordResetEmail,
  sendFirebaseEmailVerification,
  sendFirebaseSignInLink,
} from "../modules/mail/services/mail.service.js";

describe("Firebase Notification & Mail Services", () => {
  describe("Firebase Cloud Messaging (FCM)", () => {
    test("sendToDevice should call admin.messaging().send with properly formatted payload", async () => {
      const mockSend = jest.fn().mockResolvedValue("projects/test/messages/msg_123");
      const spy = jest.spyOn(admin, "messaging").mockReturnValue({
        send: mockSend,
      });

      const response = await sendToDevice("mock_fcm_token_xyz", {
        title: "Match Invitation",
        body: "You have been invited to a Cricket match!",
        data: { matchId: "match_99", sport: "cricket" },
      });

      expect(response.messageId).toBe("projects/test/messages/msg_123");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "mock_fcm_token_xyz",
          notification: {
            title: "Match Invitation",
            body: "You have been invited to a Cricket match!",
          },
          data: {
            matchId: "match_99",
            sport: "cricket",
          },
        })
      );

      spy.mockRestore();
    });

    test("sendToMultipleDevices should call sendEachForMulticast with deduplicated tokens", async () => {
      const mockMulticast = jest.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0,
      });

      const spy = jest.spyOn(admin, "messaging").mockReturnValue({
        sendEachForMulticast: mockMulticast,
      });

      const tokens = ["token_1", "token_2", "token_1"]; // token_1 duplicate
      const result = await sendToMultipleDevices(tokens, {
        title: "Tournament Alert",
        body: "Registrations now open",
      });

      expect(result.successCount).toBe(2);
      expect(mockMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ["token_1", "token_2"],
        })
      );

      spy.mockRestore();
    });

    test("sendToTopic should format topic message properly", async () => {
      const mockSend = jest.fn().mockResolvedValue("msg_topic_123");
      const spy = jest.spyOn(admin, "messaging").mockReturnValue({
        send: mockSend,
      });

      const result = await sendToTopic("/topics/football_matches", {
        title: "New Game Nearby",
        body: "7v7 turf game starting at 7 PM",
      });

      expect(result.messageId).toBe("msg_topic_123");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "football_matches",
        })
      );

      spy.mockRestore();
    });
  });

  describe("Native Firebase Mail Service (Identity Toolkit)", () => {
    test("sendFirebasePasswordResetEmail should request Firebase Identity Toolkit sendOobCode", async () => {
      const spyAuth = jest.spyOn(admin, "auth").mockReturnValue({
        getUserByEmail: jest.fn().mockResolvedValue({ uid: "fb_user_123", email: "player@example.com" }),
      });

      // Mock global fetch for Identity Toolkit
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          kind: "identitytoolkit#GetOobConfirmationCodeResponse",
          email: "player@example.com",
        }),
      });

      const result = await sendFirebasePasswordResetEmail("player@example.com");
      expect(result.success).toBe(true);
      expect(result.method).toBe("firebase_native_auth_email");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("accounts:sendOobCode"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            requestType: "PASSWORD_RESET",
            email: "player@example.com",
          }),
        })
      );

      global.fetch = originalFetch;
      spyAuth.mockRestore();
    });

    test("sendFirebaseEmailVerification should dispatch VERIFY_EMAIL request to Firebase", async () => {
      const spyAuth = jest.spyOn(admin, "auth").mockReturnValue({
        getUserByEmail: jest.fn().mockResolvedValue({ uid: "fb_user_123", email: "player@example.com" }),
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          kind: "identitytoolkit#GetOobConfirmationCodeResponse",
          email: "player@example.com",
        }),
      });

      const result = await sendFirebaseEmailVerification("player@example.com");
      expect(result.success).toBe(true);
      expect(result.method).toBe("firebase_native_verification_email");

      global.fetch = originalFetch;
      spyAuth.mockRestore();
    });
  });
});

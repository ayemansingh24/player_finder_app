import { jest } from "@jest/globals";
import admin from "../config/firebase.js";
import {
  sendToDevice,
  sendToMultipleDevices,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
} from "../services/firebaseNotification.service.js";
import {
  generateFirebasePasswordResetLink,
  generateFirebaseEmailVerificationLink,
  queueFirestoreEmail,
} from "../services/firebaseMail.service.js";

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

  describe("Firebase Mail Service", () => {
    test("generateFirebasePasswordResetLink should call admin.auth().generatePasswordResetLink", async () => {
      const mockLink = "https://ozume-25a68.firebaseapp.com/__/auth/action?mode=resetPassword";
      const spy = jest.spyOn(admin, "auth").mockReturnValue({
        generatePasswordResetLink: jest.fn().mockResolvedValue(mockLink),
      });

      const link = await generateFirebasePasswordResetLink("player@example.com");
      expect(link).toBe(mockLink);

      spy.mockRestore();
    });

    test("generateFirebaseEmailVerificationLink should call admin.auth().generateEmailVerificationLink", async () => {
      const mockLink = "https://ozume-25a68.firebaseapp.com/__/auth/action?mode=verifyEmail";
      const spy = jest.spyOn(admin, "auth").mockReturnValue({
        generateEmailVerificationLink: jest.fn().mockResolvedValue(mockLink),
      });

      const link = await generateFirebaseEmailVerificationLink("player@example.com");
      expect(link).toBe(mockLink);

      spy.mockRestore();
    });

    test("queueFirestoreEmail should add email document into 'mail' collection", async () => {
      const mockAdd = jest.fn().mockResolvedValue({ id: "firestore_mail_doc_456" });
      const mockCollection = jest.fn().mockReturnValue({ add: mockAdd });

      const spy = jest.spyOn(admin, "firestore").mockReturnValue({
        collection: mockCollection,
      });

      const docId = await queueFirestoreEmail({
        to: "recipient@example.com",
        subject: "Welcome Player!",
        html: "<p>Welcome to the platform</p>",
      });

      expect(docId).toBe("firestore_mail_doc_456");
      expect(mockCollection).toHaveBeenCalledWith("mail");
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["recipient@example.com"],
          message: expect.objectContaining({
            subject: "Welcome Player!",
            html: "<p>Welcome to the platform</p>",
          }),
        })
      );

      spy.mockRestore();
    });
  });
});

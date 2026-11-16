import { jest } from "@jest/globals";
import request from "supertest";
import { app } from "../server.js";
import { UserProfile } from "../modules/user/models/userProfile.model.js";

describe("User Module - API Endpoints (Supertest)", () => {
  describe("Unauthorized Access Protection", () => {
    test("GET /api/v1/users/me without token should return 401 Unauthorized", async () => {
      const response = await request(app).get("/api/v1/users/me");
      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/Unauthorized request|missing/i);
    });

    test("PATCH /api/v1/users/me without token should return 401 Unauthorized", async () => {
      const response = await request(app)
        .patch("/api/v1/users/me")
        .send({ displayName: "Hacker" });
      expect(response.status).toBe(401);
    });

    test("PUT /api/v1/users/me/sports without token should return 401 Unauthorized", async () => {
      const response = await request(app)
        .put("/api/v1/users/me/sports")
        .send({ sports: [{ sport: "cricket" }] });
      expect(response.status).toBe(401);
    });

    test("PATCH /api/v1/users/me/location without token should return 401 Unauthorized", async () => {
      const response = await request(app)
        .patch("/api/v1/users/me/location")
        .send({ coordinates: [77.2, 28.6] });
      expect(response.status).toBe(401);
    });

    test("PATCH /api/v1/users/me/availability without token should return 401 Unauthorized", async () => {
      const response = await request(app)
        .patch("/api/v1/users/me/availability")
        .send({ status: "available" });
      expect(response.status).toBe(401);
    });
  });

  describe("Public User Profile Retrieval & Sanitization", () => {
    test("GET /api/v1/users/:userId should return 404 when player is not found", async () => {
      const spy = jest.spyOn(UserProfile, "findOne").mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(null),
      });

      const response = await request(app).get("/api/v1/users/507f1f77bcf86cd799439011");
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Player profile not found");
      spy.mockRestore();
    });

    test("GET /api/v1/users/:userId should return sanitized profile hiding coordinates and sensitive auth fields", async () => {
      const mockProfileDoc = {
        _id: "60c72b2f9b1d8b0015b6d111",
        authUser: {
          _id: "507f1f77bcf86cd799439011",
          username: "virat18",
        },
        displayName: "Virat Kohli",
        avatar: { url: "https://example.com/virat.jpg" },
        bio: "Right-handed top order batsman",
        preferredLanguage: "en",
        sportsProfiles: [
          {
            sport: "cricket",
            experienceLevel: "advanced",
            preferredPositions: ["Top Order Batsman"],
            skills: ["Cover drive", "Chasing"],
            yearsOfExperience: 15,
            isPrimarySport: true,
          },
        ],
        availability: { status: "available" },
        location: {
          city: "New Delhi",
          state: "Delhi",
          country: "India",
          geo: {
            type: "Point",
            coordinates: [77.209, 28.6139],
          },
          isSharingEnabled: true,
        },
        h3Index: "8828308281fffff",
        onboardingCompleted: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      const spy = jest.spyOn(UserProfile, "findOne").mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfileDoc),
      });

      const response = await request(app).get("/api/v1/users/507f1f77bcf86cd799439011");
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data.username).toBe("virat18");
      expect(data.displayName).toBe("Virat Kohli");
      expect(data.sportsProfiles).toHaveLength(1);
      expect(data.location.city).toBe("New Delhi");

      // Verify privacy guarantees: no coordinates, no DOB, no passwords, no tokens
      expect(data.location.coordinates).toBeUndefined();
      expect(data.location.geo).toBeUndefined();
      expect(data.h3Index).toBeUndefined();
      expect(data.dateOfBirth).toBeUndefined();
      expect(data.password).toBeUndefined();
      expect(data.refreshToken).toBeUndefined();
      expect(data.email).toBeUndefined();

      spy.mockRestore();
    });
  });
});

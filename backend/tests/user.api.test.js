import { jest } from "@jest/globals";
import request from "supertest";
import { app } from "../server.js";
import { UserProfile } from "../modules/user/models/userProfile.model.js";
import { UserSport } from "../modules/userSports/models/userSport.model.js";
import { Sport } from "../modules/sports/models/sport.model.js";
import { SPORTS_CONFIG } from "../config/sports.config.js";

describe("User & Sports Modules - API Endpoints (Supertest)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Public Sports Catalogue Endpoints", () => {
    test("GET /api/v1/sports should return 200 with all active sports", async () => {
      jest.spyOn(Sport, "find").mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          sort: jest.fn().mockResolvedValueOnce(
            SPORTS_CONFIG.map((s) => ({
              ...s,
              isActive: true,
            }))
          ),
        }),
      });

      const response = await request(app).get("/api/v1/sports");
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(9);
      expect(response.body.data.some((s) => s.slug === "football")).toBe(true);
    });

    test("GET /api/v1/sports/:slug should return 200 for a valid sport", async () => {
      const football = SPORTS_CONFIG.find((s) => s.slug === "football");
      jest.spyOn(Sport, "findOne").mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(football),
      });

      const response = await request(app).get("/api/v1/sports/football");
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Football");
      expect(response.body.data.hasPositions).toBe(true);
    });

    test("GET /api/v1/sports/:slug should return 404 for an invalid sport", async () => {
      jest.spyOn(Sport, "findOne").mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });

      const response = await request(app).get("/api/v1/sports/rugby");
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });
  });

  describe("Unauthorized Access Protection (JWT Guards)", () => {
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

    test("GET /api/v1/users/me/sports without token should return 401 Unauthorized", async () => {
      const response = await request(app).get("/api/v1/users/me/sports");
      expect(response.status).toBe(401);
    });

    test("POST /api/v1/users/me/sports without token should return 401 Unauthorized", async () => {
      const response = await request(app)
        .post("/api/v1/users/me/sports")
        .send({ sportSlug: "cricket", experienceLevel: 5 });
      expect(response.status).toBe(401);
    });

    test("PATCH /api/v1/users/me/sports/:sportSlug without token should return 401 Unauthorized", async () => {
      const response = await request(app)
        .patch("/api/v1/users/me/sports/cricket")
        .send({ experienceLevel: 7 });
      expect(response.status).toBe(401);
    });

    test("DELETE /api/v1/users/me/sports/:sportSlug without token should return 401 Unauthorized", async () => {
      const response = await request(app).delete("/api/v1/users/me/sports/cricket");
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

      const mockUserSports = [
        {
          authUser: "507f1f77bcf86cd799439011",
          sport: {
            name: "Cricket",
            slug: "cricket",
            hasPositions: true,
          },
          experienceLevel: 10,
          preferredPositions: ["batsman"],
          isPrimarySport: true,
        },
      ];

      const profileSpy = jest.spyOn(UserProfile, "findOne").mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfileDoc),
      });

      const sportsSpy = jest.spyOn(UserSport, "find").mockReturnValueOnce({
        populate: jest.fn().mockReturnValueOnce({
          sort: jest.fn().mockResolvedValueOnce(mockUserSports),
        }),
      });

      const response = await request(app).get("/api/v1/users/507f1f77bcf86cd799439011");
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data.username).toBe("virat18");
      expect(data.displayName).toBe("Virat Kohli");
      expect(data.sports).toHaveLength(1);
      expect(data.sports[0].sport).toBe("Cricket");
      expect(data.sports[0].slug).toBe("cricket");
      expect(data.sports[0].experienceLevel).toBe(10);
      expect(data.sports[0].experienceCategory).toBe("Elite / Pro");
      expect(data.location.city).toBe("New Delhi");

      // Verify privacy guarantees: no coordinates, no DOB, no passwords, no tokens
      expect(data.location.coordinates).toBeUndefined();
      expect(data.location.geo).toBeUndefined();
      expect(data.h3Index).toBeUndefined();
      expect(data.dateOfBirth).toBeUndefined();
      expect(data.password).toBeUndefined();
      expect(data.refreshToken).toBeUndefined();
      expect(data.email).toBeUndefined();

      profileSpy.mockRestore();
      sportsSpy.mockRestore();
    });
  });
});

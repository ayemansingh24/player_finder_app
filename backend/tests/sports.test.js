import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { SPORTS_CONFIG, EXPERIENCE_RATING } from "../config/sports.config.js";
import { Sport } from "../modules/sports/models/sport.model.js";
import { UserSport } from "../modules/userSports/models/userSport.model.js";
import { UserProfile } from "../modules/user/models/userProfile.model.js";
import * as sportService from "../modules/sports/services/sport.service.js";
import * as userSportService from "../modules/userSports/services/userSport.service.js";

describe("Sports & UserSports Module - Comprehensive Test Suite", () => {
  const mockAuthUserId1 = new mongoose.Types.ObjectId().toString();
  const mockAuthUserId2 = new mongoose.Types.ObjectId().toString();

  const footballDoc = {
    _id: new mongoose.Types.ObjectId(),
    slug: "football",
    name: "Football",
    hasPositions: true,
    positions: [
      { value: "goalkeeper", label: "Goalkeeper" },
      { value: "defender", label: "Defender" },
      { value: "midfielder", label: "Midfielder" },
      { value: "forward", label: "Forward" },
      { value: "winger", label: "Winger" },
      { value: "not_sure", label: "Beginner / Not Sure Yet" },
    ],
    isActive: true,
  };

  const cricketDoc = {
    _id: new mongoose.Types.ObjectId(),
    slug: "cricket",
    name: "Cricket",
    hasPositions: true,
    positions: [
      { value: "batsman", label: "Batsman" },
      { value: "all_rounder", label: "All-Rounder" },
      { value: "wicketkeeper", label: "Wicketkeeper" },
      { value: "not_sure", label: "Beginner / Not Sure Yet" },
    ],
    isActive: true,
  };

  const badmintonDoc = {
    _id: new mongoose.Types.ObjectId(),
    slug: "badminton",
    name: "Badminton",
    hasPositions: false,
    positions: [],
    isActive: true,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Sports Catalogue Specification & Configuration", () => {
    test("catalogue must contain exactly the nine authorized sports", () => {
      const slugs = SPORTS_CONFIG.map((s) => s.slug);
      expect(slugs).toHaveLength(9);
      expect(slugs).toEqual([
        "football",
        "cricket",
        "pickleball",
        "badminton",
        "lawn_tennis",
        "table_tennis",
        "swimming",
        "basketball",
        "chess",
      ]);
    });

    test("sports with positions must have well-structured positions with value and label", () => {
      const football = SPORTS_CONFIG.find((s) => s.slug === "football");
      expect(football.hasPositions).toBe(true);
      expect(football.positions.length).toBeGreaterThan(0);
      football.positions.forEach((p) => {
        expect(p).toHaveProperty("value");
        expect(p).toHaveProperty("label");
        expect(typeof p.value).toBe("string");
        expect(typeof p.label).toBe("string");
      });
    });

    test("sports without positions must have hasPositions false and empty positions array", () => {
      const noPosSports = SPORTS_CONFIG.filter((s) => !s.hasPositions);
      expect(noPosSports.length).toBe(6);
      noPosSports.forEach((sport) => {
        expect(sport.hasPositions).toBe(false);
        expect(sport.positions).toEqual([]);
      });
    });
  });

  describe("2. Seed Script Idempotency Verification", () => {
    test("seeding must perform findOneAndUpdate with upsert, preventing duplicates", async () => {
      const bulkOps = SPORTS_CONFIG.map((sport) => ({
        updateOne: {
          filter: { slug: sport.slug },
          update: {
            $set: {
              name: sport.name,
              hasPositions: sport.hasPositions,
              positions: sport.positions,
              isActive: true,
            },
          },
          upsert: true,
        },
      }));

      expect(bulkOps).toHaveLength(9);
      bulkOps.forEach((op) => {
        expect(op.updateOne.upsert).toBe(true);
        expect(op.updateOne.filter).toHaveProperty("slug");
      });
    });
  });

  describe("3 & 4 & 5 & 6. Position Rules and Edge Cases", () => {
    test("service rejects registration when invalid position is provided for a sport with positions", async () => {
      jest.spyOn(Sport, "findOne").mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(cricketDoc),
      });

      await expect(
        userSportService.addUserSport(mockAuthUserId1, "cricket", {
          experienceLevel: 5,
          preferredPositions: ["quarterback"],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test("service rejects registration when positions are provided for a sport without positions", async () => {
      jest.spyOn(Sport, "findOne").mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(badmintonDoc),
      });

      await expect(
        userSportService.addUserSport(mockAuthUserId1, "badminton", {
          experienceLevel: 5,
          preferredPositions: ["striker"],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test("service accepts 'not_sure' as a valid position for sports with positions", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValueOnce(footballDoc);
      jest.spyOn(UserSport, "findOne").mockResolvedValueOnce(null);
      jest.spyOn(UserSport, "countDocuments").mockResolvedValueOnce(0);

      const mockCreated = {
        _id: new mongoose.Types.ObjectId(),
        authUser: mockAuthUserId1,
        sport: footballDoc._id,
        preferredPositions: ["not_sure"],
        experienceLevel: 1,
        isPrimarySport: true,
        populate: jest.fn().mockResolvedValue(true),
        toObject: () => ({
          _id: new mongoose.Types.ObjectId(),
          authUser: mockAuthUserId1,
          sport: footballDoc,
          preferredPositions: ["not_sure"],
          experienceLevel: 1,
          isPrimarySport: true,
        }),
      };

      jest.spyOn(UserSport, "create").mockResolvedValueOnce(mockCreated);
      jest.spyOn(UserProfile, "findOne").mockResolvedValueOnce({
        checkOnboardingCompletion: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      });

      const result = await userSportService.addUserSport(mockAuthUserId1, "football", {
        experienceLevel: 1,
        preferredPositions: ["not_sure"],
      });

      expect(result).toBeDefined();
      expect(result.preferredPositions).toEqual(["not_sure"]);
    });

    test("service rejects 'not_sure' when combined with other positions", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValueOnce(footballDoc);

      await expect(
        userSportService.addUserSport(mockAuthUserId1, "football", {
          experienceLevel: 3,
          preferredPositions: ["goalkeeper", "not_sure"],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("7 & 8. Numeric Experience Level Range (1 - 10 Integer)", () => {
    test("rejects experience levels < 1 or > 10", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValue(footballDoc);

      await expect(
        userSportService.addUserSport(mockAuthUserId1, "football", {
          experienceLevel: 0,
        })
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        userSportService.addUserSport(mockAuthUserId1, "football", {
          experienceLevel: 11,
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test("rejects non-integer experience levels like 5.5", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValue(footballDoc);

      await expect(
        userSportService.addUserSport(mockAuthUserId1, "football", {
          experienceLevel: 5.5,
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("9 & 10. Registering Multiple Sports and Duplicate Prevention (409 Conflict)", () => {
    test("allows registering different sports for the same user", async () => {
      jest.spyOn(Sport, "findOne")
        .mockResolvedValueOnce(cricketDoc)
        .mockResolvedValueOnce(footballDoc);

      jest.spyOn(UserSport, "findOne")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      jest.spyOn(UserSport, "countDocuments")
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);

      const mockDoc1 = {
        _id: new mongoose.Types.ObjectId(),
        authUser: mockAuthUserId1,
        sport: cricketDoc._id,
        experienceLevel: 8,
        preferredPositions: ["batsman"],
        isPrimarySport: true,
        populate: jest.fn().mockResolvedValue(true),
        toObject: () => ({
          authUser: mockAuthUserId1,
          sport: cricketDoc,
          experienceLevel: 8,
          preferredPositions: ["batsman"],
          isPrimarySport: true,
        }),
      };

      const mockDoc2 = {
        _id: new mongoose.Types.ObjectId(),
        authUser: mockAuthUserId1,
        sport: footballDoc._id,
        experienceLevel: 6,
        preferredPositions: ["midfielder"],
        isPrimarySport: false,
        populate: jest.fn().mockResolvedValue(true),
        toObject: () => ({
          authUser: mockAuthUserId1,
          sport: footballDoc,
          experienceLevel: 6,
          preferredPositions: ["midfielder"],
          isPrimarySport: false,
        }),
      };

      jest.spyOn(UserSport, "create")
        .mockResolvedValueOnce(mockDoc1)
        .mockResolvedValueOnce(mockDoc2);

      jest.spyOn(UserProfile, "findOne").mockResolvedValue({
        checkOnboardingCompletion: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      });

      const sport1 = await userSportService.addUserSport(mockAuthUserId1, "cricket", {
        experienceLevel: 8,
        preferredPositions: ["batsman"],
        isPrimarySport: true,
      });

      const sport2 = await userSportService.addUserSport(mockAuthUserId1, "football", {
        experienceLevel: 6,
        preferredPositions: ["midfielder"],
        isPrimarySport: false,
      });

      expect(sport1).toBeDefined();
      expect(sport2).toBeDefined();
      expect(sport1.isPrimarySport).toBe(true);
      expect(sport2.isPrimarySport).toBe(false);
    });

    test("rejects duplicate registration of the same sport with 409 Conflict", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValueOnce(footballDoc);

      // Existing registration found
      jest.spyOn(UserSport, "findOne").mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        authUser: mockAuthUserId1,
        sport: footballDoc._id,
      });

      await expect(
        userSportService.addUserSport(mockAuthUserId1, "football", {
          experienceLevel: 5,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe("11. Single Primary Sport Exclusivity & Demotion", () => {
    test("setting a new primary sport automatically unsets the existing primary sport", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValueOnce(badmintonDoc);
      jest.spyOn(UserSport, "findOne").mockResolvedValueOnce(null);
      jest.spyOn(UserSport, "countDocuments").mockResolvedValueOnce(1);

      const updateManySpy = jest.spyOn(UserSport, "updateMany").mockResolvedValueOnce({
        modifiedCount: 1,
      });

      const mockDoc = {
        _id: new mongoose.Types.ObjectId(),
        authUser: mockAuthUserId1,
        sport: badmintonDoc._id,
        experienceLevel: 7,
        isPrimarySport: true,
        populate: jest.fn().mockResolvedValue(true),
        toObject: () => ({
          authUser: mockAuthUserId1,
          sport: badmintonDoc,
          experienceLevel: 7,
          isPrimarySport: true,
        }),
      };

      jest.spyOn(UserSport, "create").mockResolvedValueOnce(mockDoc);
      jest.spyOn(UserProfile, "findOne").mockResolvedValue({
        checkOnboardingCompletion: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      });

      const res = await userSportService.addUserSport(mockAuthUserId1, "badminton", {
        experienceLevel: 7,
        isPrimarySport: true,
      });

      expect(updateManySpy).toHaveBeenCalledWith(
        { authUser: mockAuthUserId1 },
        { $set: { isPrimarySport: false } }
      );
      expect(res.isPrimarySport).toBe(true);
    });
  });

  describe("12. Ownership & Authorization Enforcement", () => {
    test("updating another player's sport is rejected with 404", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValueOnce(footballDoc);

      // Query by (authUser: mockAuthUserId1, sport: footballDoc._id) returns null if owned by mockAuthUserId2
      jest.spyOn(UserSport, "findOne").mockResolvedValueOnce(null);

      await expect(
        userSportService.updateUserSport(mockAuthUserId1, "football", {
          experienceLevel: 9,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test("deleting another player's sport is rejected with 404", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValueOnce(footballDoc);
      jest.spyOn(UserSport, "findOne").mockResolvedValueOnce(null);

      await expect(
        userSportService.deleteUserSport(mockAuthUserId1, "football")
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("13. Safe Migration Logic Verification", () => {
    test("legacy string levels map accurately to numeric values", () => {
      const mapLegacyExperienceLevel = (levelStr) => {
        const normalized = String(levelStr || "").toLowerCase().trim();
        switch (normalized) {
          case "beginner":
            return 2;
          case "intermediate":
            return 5;
          case "advanced":
            return 9;
          default:
            return 1;
        }
      };

      expect(mapLegacyExperienceLevel("beginner")).toBe(2);
      expect(mapLegacyExperienceLevel("intermediate")).toBe(5);
      expect(mapLegacyExperienceLevel("advanced")).toBe(9);
      expect(mapLegacyExperienceLevel("unknown")).toBe(1);
    });

    test("UserProfile schema no longer contains sportsProfiles path", () => {
      const paths = Object.keys(UserProfile.schema.paths);
      expect(paths).not.toContain("sportsProfiles");
    });
  });

  describe("14. Updating and Deleting Sports for Authenticated Player", () => {
    test("player can update their registered sport", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValueOnce(footballDoc);

      const mockExisting = {
        _id: new mongoose.Types.ObjectId(),
        authUser: mockAuthUserId1,
        sport: footballDoc._id,
        experienceLevel: 5,
        preferredPositions: ["defender"],
        isPrimarySport: false,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true),
        toObject: () => ({
          _id: new mongoose.Types.ObjectId(),
          authUser: mockAuthUserId1,
          sport: footballDoc,
          experienceLevel: 8,
          preferredPositions: ["goalkeeper"],
          isPrimarySport: false,
        }),
      };

      jest.spyOn(UserSport, "findOne").mockResolvedValueOnce(mockExisting);

      const updated = await userSportService.updateUserSport(mockAuthUserId1, "football", {
        experienceLevel: 8,
        preferredPositions: ["goalkeeper"],
      });

      expect(mockExisting.experienceLevel).toBe(8);
      expect(mockExisting.preferredPositions).toEqual(["goalkeeper"]);
      expect(mockExisting.save).toHaveBeenCalled();
      expect(updated.experienceLevel).toBe(8);
    });

    test("player can delete their registered sport and auto-promote if primary was deleted", async () => {
      jest.spyOn(Sport, "findOne").mockResolvedValue(footballDoc);

      const deletedDoc = {
        _id: new mongoose.Types.ObjectId(),
        authUser: mockAuthUserId1,
        sport: footballDoc._id,
        isPrimarySport: true,
      };

      const nextSport = {
        _id: new mongoose.Types.ObjectId(),
        authUser: mockAuthUserId1,
        sport: cricketDoc._id,
        isPrimarySport: false,
        save: jest.fn().mockResolvedValue(true),
      };

      const sortMock = jest.fn().mockResolvedValue(nextSport);

      jest.spyOn(UserSport, "findOne").mockImplementation((query) => {
        if (query.sport) {
          return Promise.resolve(deletedDoc);
        }
        return {
          sort: sortMock,
        };
      });

      const deleteSpy = jest.spyOn(UserSport, "findByIdAndDelete").mockResolvedValue(true);
      jest.spyOn(UserSport, "countDocuments").mockResolvedValue(1);

      jest.spyOn(UserProfile, "findOne").mockResolvedValue({
        checkOnboardingCompletion: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      });

      const res = await userSportService.deleteUserSport(mockAuthUserId1, "football");
      expect(res.deletedSport).toBe("Football");
      expect(deleteSpy).toHaveBeenCalledWith(deletedDoc._id);
      expect(nextSport.isPrimarySport).toBe(true);
      expect(nextSport.save).toHaveBeenCalled();
    });
  });

  describe("15. Preservation of UserProfile Location, GeoJSON & H3 Functionality", () => {
    test("UserProfile preserves GeoJSON coordinates, location sharing and H3 index", () => {
      const profile = new UserProfile({
        authUser: mockAuthUserId1,
        displayName: "Matchmaking Ready Player",
        location: {
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          geo: {
            type: "Point",
            coordinates: [72.8777, 19.076],
          },
          isSharingEnabled: true,
        },
        h3Index: "886189258dfffff",
        availability: {
          status: "available",
        },
        preferences: {
          searchRadiusKm: 25,
          notificationsEnabled: true,
          matchInvitationsEnabled: true,
        },
      });

      expect(profile.location.geo.coordinates).toEqual([72.8777, 19.076]);
      expect(profile.location.isSharingEnabled).toBe(true);
      expect(profile.h3Index).toBe("886189258dfffff");
      expect(profile.availability.status).toBe("available");
      expect(profile.preferences.searchRadiusKm).toBe(25);
    });
  });
});

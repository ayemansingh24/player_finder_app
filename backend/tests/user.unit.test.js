import {
  validateLocationInput,
  validateProfileUpdate,
  validateAvailabilityInput,
  validatePreferencesInput,
} from "../modules/user/validations/user.validation.js";
import {
  validateExperienceLevel,
  validatePositionsForSport,
  validateUserSportInput,
} from "../modules/userSports/validations/userSport.validation.js";
import { calculateH3Index, isValidH3Index } from "../utils/h3.utils.js";
import { UserProfile } from "../modules/user/models/userProfile.model.js";
import { SPORTS_CONFIG } from "../config/sports.config.js";

describe("User & Sports Module - Unit Tests", () => {
  const cricketDoc = SPORTS_CONFIG.find((s) => s.slug === "cricket");
  const footballDoc = SPORTS_CONFIG.find((s) => s.slug === "football");
  const badmintonDoc = SPORTS_CONFIG.find((s) => s.slug === "badminton");

  describe("Experience Level Validation (1-10 Integer)", () => {
    test("should accept valid integer experience levels from 1 to 10", () => {
      [1, 2, 5, 8, 10].forEach((lvl) => {
        const res = validateExperienceLevel(lvl);
        expect(res.isValid).toBe(true);
        expect(res.value).toBe(lvl);
      });
    });

    test("should reject 0, 11, negative numbers, and out-of-range integers", () => {
      [0, 11, -1, 100].forEach((lvl) => {
        const res = validateExperienceLevel(lvl);
        expect(res.isValid).toBe(false);
        expect(res.error).toMatch(/between 1 and 10/);
      });
    });

    test("should reject non-integers and floating-point numbers", () => {
      [5.5, 1.2, 9.99].forEach((lvl) => {
        const res = validateExperienceLevel(lvl);
        expect(res.isValid).toBe(false);
        expect(res.error).toMatch(/must be an integer/);
      });
    });

    test("should reject string, null, and undefined values", () => {
      ["5", "beginner", null, undefined, {}].forEach((val) => {
        const res = validateExperienceLevel(val);
        expect(res.isValid).toBe(false);
      });
    });
  });

  describe("Sport Positions Validation", () => {
    test("should accept valid positions for sports that have positions", () => {
      const res = validatePositionsForSport(["batsman", "wicketkeeper"], cricketDoc);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedPositions).toEqual(["batsman", "wicketkeeper"]);
    });

    test("should reject invalid positions for sports with positions", () => {
      const res = validatePositionsForSport(["quarterback", "batsman"], cricketDoc);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("not a valid position"))).toBe(true);
    });

    test("should reject non-empty positions array for sports without positions", () => {
      const res = validatePositionsForSport(["striker"], badmintonDoc);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("does not support positions"))).toBe(true);
    });

    test("should accept empty or omitted positions for sports without positions", () => {
      const res1 = validatePositionsForSport([], badmintonDoc);
      expect(res1.isValid).toBe(true);
      expect(res1.sanitizedPositions).toEqual([]);

      const res2 = validatePositionsForSport(undefined, badmintonDoc);
      expect(res2.isValid).toBe(true);
      expect(res2.sanitizedPositions).toEqual([]);
    });

    test("should accept 'not_sure' when selected alone", () => {
      const res = validatePositionsForSport(["not_sure"], footballDoc);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedPositions).toEqual(["not_sure"]);
    });

    test("should reject 'not_sure' when combined with other specific positions", () => {
      const res = validatePositionsForSport(["goalkeeper", "not_sure"], footballDoc);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("cannot be selected alongside"))).toBe(true);
    });
  });

  describe("Full UserSport Input Validation", () => {
    test("should validate and sanitize valid sport registration payload", () => {
      const payload = {
        sportSlug: "football",
        experienceLevel: 7,
        preferredPositions: ["midfielder", "forward"],
        isPrimarySport: true,
      };

      const result = validateUserSportInput(payload, footballDoc, false);
      expect(result.isValid).toBe(true);
      expect(result.sanitized.experienceLevel).toBe(7);
      expect(result.sanitized.preferredPositions).toEqual(["midfielder", "forward"]);
      expect(result.sanitized.isPrimarySport).toBe(true);
    });

    test("should reject payload with missing or invalid fields", () => {
      const payload = {
        experienceLevel: 15,
        preferredPositions: "not-an-array",
      };

      const result = validateUserSportInput(payload, cricketDoc, false);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Location Validation & Uber H3 Calculation", () => {
    test("should calculate a valid Uber H3 index from GeoJSON coordinates [longitude, latitude]", () => {
      const coords = [-0.1276, 51.5074];
      const h3Index = calculateH3Index(coords, 8);

      expect(h3Index).toBeDefined();
      expect(typeof h3Index).toBe("string");
      expect(isValidH3Index(h3Index)).toBe(true);
    });

    test("should reject out-of-range GPS coordinates", () => {
      const invalidLat = { coordinates: [77.209, 120] };
      const invalidLng = { coordinates: [200, 28.6139] };

      const resultLat = validateLocationInput(invalidLat);
      expect(resultLat.isValid).toBe(false);
      expect(resultLat.errors.some((e) => e.includes("Latitude"))).toBe(true);

      const resultLng = validateLocationInput(invalidLng);
      expect(resultLng.isValid).toBe(false);
      expect(resultLng.errors.some((e) => e.includes("Longitude"))).toBe(true);
    });

    test("should accept valid location fields and sanitize correctly", () => {
      const validLocation = {
        coordinates: [77.209, 28.6139],
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        isSharingEnabled: true,
      };

      const { isValid, errors, sanitized } = validateLocationInput(validLocation);
      expect(isValid).toBe(true);
      expect(errors).toHaveLength(0);
      expect(sanitized.coordinates).toEqual([77.209, 28.6139]);
      expect(sanitized.isSharingEnabled).toBe(true);
      expect(sanitized.city).toBe("New Delhi");
    });
  });

  describe("Profile Update & Sensitive Field Protection", () => {
    test("should prevent direct modification of forbidden and security fields", () => {
      const forbiddenAttempt = {
        displayName: "Valid Name",
        authUser: "60c72b2f9b1d8b0015b6d999",
        h3Index: "8828308281fffff",
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        ratingsSummary: { isRated: true },
      };

      const { isValid, errors, sanitized } = validateProfileUpdate(forbiddenAttempt);
      expect(isValid).toBe(false);
      expect(errors.some((e) => e.includes("authUser"))).toBe(true);
      expect(errors.some((e) => e.includes("h3Index"))).toBe(true);
      expect(errors.some((e) => e.includes("onboardingCompleted"))).toBe(true);
      expect(sanitized.authUser).toBeUndefined();
      expect(sanitized.h3Index).toBeUndefined();
    });

    test("should accept permitted fields like bio, displayName, and language", () => {
      const validUpdate = {
        displayName: "Ayeman Player",
        bio: "Passionate cricket batsman and weekend football goalie.",
        preferredLanguage: "en",
      };

      const { isValid, errors, sanitized } = validateProfileUpdate(validUpdate);
      expect(isValid).toBe(true);
      expect(errors).toHaveLength(0);
      expect(sanitized.displayName).toBe("Ayeman Player");
      expect(sanitized.bio).toBe("Passionate cricket batsman and weekend football goalie.");
      expect(sanitized.preferredLanguage).toBe("en");
    });
  });

  describe("Onboarding Status Backend Calculation", () => {
    test("onboardingCompleted should remain false if no sports profiles are registered", async () => {
      const doc = new UserProfile({
        authUser: "60c72b2f9b1d8b0015b6d999",
        displayName: "New Player",
      });

      const isComplete = await doc.checkOnboardingCompletion(false);
      expect(isComplete).toBe(false);
      expect(doc.onboardingCompleted).toBe(false);
      expect(doc.onboardingCompletedAt).toBeNull();
    });

    test("onboardingCompleted should become true once display name and at least one sport are registered", async () => {
      const doc = new UserProfile({
        authUser: "60c72b2f9b1d8b0015b6d999",
        displayName: "New Player",
      });

      const isComplete = await doc.checkOnboardingCompletion(true);
      expect(isComplete).toBe(true);
      expect(doc.onboardingCompleted).toBe(true);
      expect(doc.onboardingCompletedAt).toBeInstanceOf(Date);
    });
  });
});

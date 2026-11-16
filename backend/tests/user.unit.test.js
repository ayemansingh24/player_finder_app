import {
  validateSportsInput,
  validateLocationInput,
  validateProfileUpdate,
  validateAvailabilityInput,
  validatePreferencesInput,
} from "../modules/user/validations/user.validation.js";
import { calculateH3Index, isValidH3Index } from "../utils/h3.utils.js";
import { UserProfile } from "../modules/user/models/userProfile.model.js";

describe("User Module - Validations & Business Logic", () => {
  describe("Sports Profile Validation (Multi-Sport & Constraints)", () => {
    test("should accept valid multiple sports registrations with distinct positions and skills", () => {
      const sportsPayload = [
        {
          sport: "football",
          experienceLevel: "intermediate",
          preferredPositions: ["Goalkeeper", "Defender"],
          skills: ["Reflexes", "Long kick"],
          yearsOfExperience: 4,
          isPrimarySport: true,
        },
        {
          sport: "cricket",
          experienceLevel: "advanced",
          preferredPositions: ["Opening Batsman", "Wicketkeeper"],
          skills: ["Cover drive", "Fast stumping"],
          yearsOfExperience: 7,
          isPrimarySport: false,
        },
      ];

      const { isValid, errors, validatedList } = validateSportsInput(sportsPayload);
      expect(isValid).toBe(true);
      expect(errors).toHaveLength(0);
      expect(validatedList).toHaveLength(2);
      expect(validatedList[0].sport).toBe("football");
      expect(validatedList[0].isPrimarySport).toBe(true);
      expect(validatedList[1].sport).toBe("cricket");
      expect(validatedList[1].isPrimarySport).toBe(false);
    });

    test("should reject duplicate sport registrations for the same player", () => {
      const duplicateSports = [
        { sport: "football", experienceLevel: "beginner" },
        { sport: "football", experienceLevel: "intermediate" },
      ];

      const { isValid, errors } = validateSportsInput(duplicateSports);
      expect(isValid).toBe(false);
      expect(errors.some((e) => e.includes("Duplicate sport"))).toBe(true);
    });

    test("should reject having more than one primary sport", () => {
      const multiplePrimary = [
        { sport: "football", experienceLevel: "beginner", isPrimarySport: true },
        { sport: "cricket", experienceLevel: "beginner", isPrimarySport: true },
      ];

      const { isValid, errors } = validateSportsInput(multiplePrimary);
      expect(isValid).toBe(false);
      expect(errors.some((e) => e.includes("At most one sport can be designated as primary"))).toBe(true);
    });

    test("should reject unsupported sports", () => {
      const unsupported = [{ sport: "underwater_hockey", experienceLevel: "beginner" }];
      const { isValid, errors } = validateSportsInput(unsupported);
      expect(isValid).toBe(false);
      expect(errors.some((e) => e.includes("not currently supported"))).toBe(true);
    });
  });

  describe("Location Validation & Uber H3 Calculation", () => {
    test("should calculate a valid Uber H3 index from GeoJSON coordinates [longitude, latitude]", () => {
      // Coordinates for London: lng: -0.1276, lat: 51.5074
      const coords = [-0.1276, 51.5074];
      const h3Index = calculateH3Index(coords, 8);

      expect(h3Index).toBeDefined();
      expect(typeof h3Index).toBe("string");
      expect(isValidH3Index(h3Index)).toBe(true);
    });

    test("should reject out-of-range GPS coordinates", () => {
      const invalidLat = { coordinates: [77.209, 120] }; // Lat > 90
      const invalidLng = { coordinates: [200, 28.6139] }; // Lng > 180

      const resultLat = validateLocationInput(invalidLat);
      expect(resultLat.isValid).toBe(false);
      expect(resultLat.errors.some((e) => e.includes("Latitude"))).toBe(true);

      const resultLng = validateLocationInput(invalidLng);
      expect(resultLng.isValid).toBe(false);
      expect(resultLng.errors.some((e) => e.includes("Longitude"))).toBe(true);
    });

    test("should accept valid location fields and sanitize correctly", () => {
      const validLocation = {
        coordinates: [77.209, 28.6139], // New Delhi [lng, lat]
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
    test("onboardingCompleted should remain false if no sports profiles are registered", () => {
      const doc = new UserProfile({
        authUser: "60c72b2f9b1d8b0015b6d999",
        displayName: "New Player",
        sportsProfiles: [],
      });

      const isComplete = doc.checkOnboardingCompletion();
      expect(isComplete).toBe(false);
      expect(doc.onboardingCompleted).toBe(false);
      expect(doc.onboardingCompletedAt).toBeNull();
    });

    test("onboardingCompleted should become true once display name and at least one sport are registered", () => {
      const doc = new UserProfile({
        authUser: "60c72b2f9b1d8b0015b6d999",
        displayName: "New Player",
        sportsProfiles: [
          {
            sport: "cricket",
            experienceLevel: "intermediate",
            preferredPositions: ["All-rounder"],
            isPrimarySport: true,
          },
        ],
      });

      const isComplete = doc.checkOnboardingCompletion();
      expect(isComplete).toBe(true);
      expect(doc.onboardingCompleted).toBe(true);
      expect(doc.onboardingCompletedAt).toBeInstanceOf(Date);
    });
  });
});

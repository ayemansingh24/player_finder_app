import mongoose, { Schema } from "mongoose";
import { SUPPORTED_SPORTS, EXPERIENCE_LEVELS, AVAILABILITY_STATUSES } from "../../../utils/constants.js";

// Subdocument Schema for Sport Profiles
const sportsProfileSubSchema = new Schema(
  {
    sport: {
      type: String,
      required: [true, "Sport identifier is required"],
      lowercase: true,
      trim: true,
      enum: {
        values: SUPPORTED_SPORTS,
        message: "{VALUE} is not a currently supported sport",
      },
    },
    experienceLevel: {
      type: String,
      required: [true, "Experience level is required"],
      enum: {
        values: EXPERIENCE_LEVELS,
        message: "Experience level must be beginner, intermediate, or advanced",
      },
      default: "beginner",
    },
    preferredPositions: {
      type: [String],
      default: [],
    },
    // Self-declared skills - demarcated from verified captain/match ratings
    skills: {
      type: [String],
      default: [],
    },
    yearsOfExperience: {
      type: Number,
      min: [0, "Years of experience cannot be negative"],
      max: [70, "Invalid years of experience"],
      default: 0,
    },
    isPrimarySport: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const userProfileSchema = new Schema(
  {
    // 1-to-1 mandatory reference to authentication account
    authUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Auth user reference is required"],
      unique: true,
      index: true,
    },

    // 1. Basic Profile Information
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
      maxlength: [60, "Display name cannot exceed 60 characters"],
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      trim: true,
      default: "",
    },
    avatar: {
      url: {
        type: String,
        default: "default-avatar",
      },
      publicId: {
        type: String,
        default: null,
      },
    },
    preferredLanguage: {
      type: String,
      default: "en",
      trim: true,
    },

    // 2. Sports Profiles
    sportsProfiles: {
      type: [sportsProfileSubSchema],
      default: [],
      validate: [
        {
          validator: function (profiles) {
            if (!profiles || profiles.length === 0) return true;
            const sports = profiles.map((p) => p.sport.toLowerCase());
            return new Set(sports).size === sports.length;
          },
          message: "Duplicate sport registrations are not allowed.",
        },
        {
          validator: function (profiles) {
            if (!profiles || profiles.length === 0) return true;
            const primaryCount = profiles.filter((p) => p.isPrimarySport).length;
            return primaryCount <= 1;
          },
          message: "At most one sport can be designated as the primary sport.",
        },
      ],
    },

    // 3. Location and H3 Geospatial Design
    location: {
      geo: {
        type: {
          type: String,
          enum: ["Point"],
          default: undefined, // Never default to Point or [0, 0] when unset
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: undefined,
          validate: {
            validator: function (coords) {
              if (coords === undefined || coords === null) return true;
              return (
                Array.isArray(coords) &&
                coords.length === 2 &&
                coords[0] >= -180 &&
                coords[0] <= 180 &&
                coords[1] >= -90 &&
                coords[1] <= 90
              );
            },
            message: "Coordinates must be [longitude (-180 to 180), latitude (-90 to 90)]",
          },
        },
      },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
      isSharingEnabled: {
        type: Boolean,
        default: false,
      },
      lastUpdatedAt: {
        type: Date,
        default: null,
      },
    },

    // Backend-computed Uber H3 Index (never trusted from client)
    h3Index: {
      type: String,
      index: true,
      default: null,
    },

    // 4. Availability
    availability: {
      status: {
        type: String,
        enum: {
          values: AVAILABILITY_STATUSES,
          message: "Status must be available, busy, or offline",
        },
        default: "offline",
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // 5. Player Preferences
    preferences: {
      searchRadiusKm: {
        type: Number,
        min: [1, "Search radius must be at least 1 km"],
        max: [100, "Search radius cannot exceed 100 km"],
        default: 15,
      },
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
      matchInvitationsEnabled: {
        type: Boolean,
        default: true,
      },
    },

    // 6. Push Notification Device Tokens (Firebase Cloud Messaging)
    fcmTokens: {
      type: [String],
      default: [],
    },

    // 7. Onboarding Lifecycle (Computed on backend, protected from direct modification)
    onboardingCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    onboardingCompletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// MongoDB 2dsphere index on location.geo for geospatial queries
userProfileSchema.index({ "location.geo": "2dsphere" });

// Compound index for discovering nearby available players who consented to share location
userProfileSchema.index({
  "location.isSharingEnabled": 1,
  "availability.status": 1,
  h3Index: 1,
});

/**
 * Evaluates whether onboarding requirements are fully satisfied:
 * - displayName is provided
 * - At least one registered sport in sportsProfiles
 */
userProfileSchema.methods.checkOnboardingCompletion = function () {
  const hasDisplayName = !!(this.displayName && this.displayName.trim().length > 0);
  const hasSports = Array.isArray(this.sportsProfiles) && this.sportsProfiles.length > 0;

  if (hasDisplayName && hasSports) {
    if (!this.onboardingCompleted) {
      this.onboardingCompleted = true;
      this.onboardingCompletedAt = new Date();
    }
  } else {
    this.onboardingCompleted = false;
    this.onboardingCompletedAt = null;
  }
  return this.onboardingCompleted;
};

export const UserProfile = mongoose.model("UserProfile", userProfileSchema);

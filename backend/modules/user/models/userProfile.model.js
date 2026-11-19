import mongoose, { Schema } from "mongoose";
import { AVAILABILITY_STATUSES } from "../../../utils/constants.js";

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

    // Gender — used as optional discovery filter
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: null,
    },

    // Discovery opt-out flag — players can hide themselves from search results
    discoveryEnabled: {
      type: Boolean,
      default: true,
    },

    // 2. Location and H3 Geospatial Design
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

    // Dual-resolution H3 cells — computed server-side, never from client
    h3Cells: {
      res7: { type: String, index: true, default: null },
      res8: { type: String, index: true, default: null },
    },

    // Legacy single-resolution index retained for backward compatibility during migration
    h3Index: {
      type: String,
      index: true,
      sparse: true,
      default: null,
    },

    // 3. Availability Architecture (Section 61)
    availability: {
      // Effective materialized status
      status: {
        type: String,
        enum: {
          values: AVAILABILITY_STATUSES,
          message: "Status must be available, busy, or offline",
        },
        default: "offline",
      },
      // Base preferred mode when no overrides or active schedules apply
      baseStatus: {
        type: String,
        enum: AVAILABILITY_STATUSES,
        default: "available",
      },
      // Manual indefinite inactivity override (Priority 1)
      manualIndefiniteInactive: {
        type: Boolean,
        default: false,
      },
      // Temporary pause expiration (Priority 2)
      temporaryPauseUntil: {
        type: Date,
        default: null,
      },
      // One-time schedules (Priority 3)
      oneTimeSchedules: [
        {
          startAt: { type: Date, required: true },
          endAt: { type: Date, required: true },
          status: { type: String, enum: AVAILABILITY_STATUSES, default: "available" },
          note: { type: String, default: "" },
        },
      ],
      // Recurring weekly schedules (Priority 4)
      recurringSchedules: [
        {
          daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0=Sun, 6=Sat
          startTime: { type: String, match: [/^\d{2}:\d{2}$/, "HH:MM format"] },
          endTime: { type: String, match: [/^\d{2}:\d{2}$/, "HH:MM format"] },
          status: { type: String, enum: AVAILABILITY_STATUSES, default: "available" },
        },
      ],
      // IANA timezone identifier
      timezone: {
        type: String,
        default: "UTC",
      },
      nextTransition: {
        type: Date,
        default: null,
      },
      scheduleVersion: {
        type: Number,
        default: 0,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // 4. Player Preferences
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

    // 5. Push Notification Device Tokens (Firebase Cloud Messaging)
    fcmTokens: {
      type: [String],
      default: [],
    },

    // 6. Onboarding Lifecycle (Computed on backend, protected from direct modification)
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

// ─── Indexes ───────────────────────────────────────────────────────────────────

// MongoDB 2dsphere index on location.geo for geospatial queries
userProfileSchema.index({ "location.geo": "2dsphere" });

// Legacy compound index (kept for backward compatibility during migration)
userProfileSchema.index({
  "location.isSharingEnabled": 1,
  "availability.status": 1,
  h3Index: 1,
});

// Discovery indexes using dual-resolution H3 cells
userProfileSchema.index({ "h3Cells.res7": 1, "availability.status": 1, "location.isSharingEnabled": 1 });
userProfileSchema.index({ "h3Cells.res8": 1, "availability.status": 1, "location.isSharingEnabled": 1 });
userProfileSchema.index({ onboardingCompleted: 1, "availability.status": 1 });

// ─── Methods ───────────────────────────────────────────────────────────────────

/**
 * Evaluates whether onboarding requirements are fully satisfied:
 * - displayName is provided
 * - At least one registered sport in UserSport collection
 *
 * @param {boolean} [hasRegisteredSports] Optional pre-computed check
 */
userProfileSchema.methods.checkOnboardingCompletion = async function (hasRegisteredSports) {
  const hasDisplayName = !!(this.displayName && this.displayName.trim().length > 0);

  let hasSports = false;
  if (typeof hasRegisteredSports === "boolean") {
    hasSports = hasRegisteredSports;
  } else {
    try {
      const UserSportModel = mongoose.models.UserSport || mongoose.model("UserSport");
      const count = await UserSportModel.countDocuments({ authUser: this.authUser });
      hasSports = count > 0;
    } catch {
      hasSports = false;
    }
  }

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

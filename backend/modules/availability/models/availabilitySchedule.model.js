import mongoose, { Schema } from "mongoose";

const availabilityScheduleSchema = new Schema(
  {
    // Reference to the owning user's auth account
    authUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "authUser is required"],
      index: true,
    },

    // Whether this is a one-time window or a recurring weekly pattern
    scheduleType: {
      type: String,
      enum: ["one_time", "recurring"],
      required: [true, "scheduleType is required"],
    },

    // The availability state this schedule enforces when active
    status: {
      type: String,
      enum: ["active", "available", "unavailable"],
      required: [true, "status is required"],
    },

    // ---- One-time schedule fields ----
    startAt: {
      type: Date,
      default: null,
    },
    endAt: {
      type: Date,
      default: null,
    },

    // ---- Recurring schedule fields ----
    // 0=Sunday, 1=Monday, ..., 6=Saturday
    daysOfWeek: {
      type: [Number],
      validate: {
        validator: (arr) => arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: "daysOfWeek must contain integers between 0 (Sun) and 6 (Sat)",
      },
      default: undefined,
    },
    // "HH:MM" in UTC
    startTimeUTC: {
      type: String,
      match: [/^\d{2}:\d{2}$/, "startTimeUTC must be in HH:MM format"],
      default: null,
    },
    endTimeUTC: {
      type: String,
      match: [/^\d{2}:\d{2}$/, "endTimeUTC must be in HH:MM format"],
      default: null,
    },

    // IANA timezone identifier used when the client specified local times
    timezone: {
      type: String,
      default: "UTC",
    },

    // Soft-delete flag; inactive schedules are ignored during computation
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Monotonically increasing version — used to discard stale BullMQ jobs
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for fast per-user active schedule retrieval
availabilityScheduleSchema.index({ authUser: 1, isActive: 1, scheduleType: 1 });

export const AvailabilitySchedule = mongoose.model(
  "AvailabilitySchedule",
  availabilityScheduleSchema
);

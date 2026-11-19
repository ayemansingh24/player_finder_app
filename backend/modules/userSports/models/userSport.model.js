import mongoose, { Schema } from "mongoose";

const userSportSchema = new Schema(
  {
    authUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Auth user reference is required"],
      index: true,
    },
    sport: {
      type: Schema.Types.ObjectId,
      ref: "Sport",
      required: [true, "Sport reference is required"],
      index: true,
    },
    preferredPositions: {
      type: [String],
      default: [],
    },
    experienceLevel: {
      type: Number,
      required: [true, "Experience level is required"],
      min: [1, "Experience level must be at least 1"],
      max: [10, "Experience level cannot exceed 10"],
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Experience must be an integer between 1 and 10",
      },
    },
    isPrimarySport: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 1. Prevent duplicate sport registrations for the same player
userSportSchema.index({ authUser: 1, sport: 1 }, { unique: true });

// 2. Enforce at most ONE primary sport per player using partial unique index
userSportSchema.index(
  { authUser: 1, isPrimarySport: 1 },
  { unique: true, partialFilterExpression: { isPrimarySport: true } }
);

// 3. Search & matchmaking compatibility indexes
userSportSchema.index({ sport: 1, experienceLevel: 1 });
userSportSchema.index({ sport: 1, preferredPositions: 1 });

export const UserSport = mongoose.model("UserSport", userSportSchema);

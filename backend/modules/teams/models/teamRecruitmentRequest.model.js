import mongoose, { Schema } from "mongoose";

const teamRecruitmentRequestSchema = new Schema(
  {
    team: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Team reference is required"],
      index: true,
    },
    captain: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Captain is required"],
    },
    sport: {
      type: Schema.Types.ObjectId,
      ref: "Sport",
      required: [true, "Sport is required"],
      index: true,
    },
    preferredPositions: {
      type: [String],
      default: [],
    },
    requiredPlayerCount: {
      type: Number,
      required: true,
      min: [1, "Must require at least 1 player"],
    },
    acceptedPlayerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 60,
    },
    playingLocation: {
      geo: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number],
          default: undefined,
        },
      },
      venue: { type: String, default: "" },
      city: { type: String, default: "" },
    },
    h3Cells: {
      res7: { type: String, default: null },
      res8: { type: String, default: null },
    },
    match: {
      type: Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },
    status: {
      type: String,
      enum: ["open", "filled", "cancelled"],
      default: "open",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

teamRecruitmentRequestSchema.index({ "playingLocation.geo": "2dsphere" });
teamRecruitmentRequestSchema.index({ sport: 1, status: 1 });

export const TeamRecruitmentRequest = mongoose.model(
  "TeamRecruitmentRequest",
  teamRecruitmentRequestSchema
);
export default TeamRecruitmentRequest;

import mongoose, { Schema } from "mongoose";

const matchSchema = new Schema(
  {
    sport: {
      type: Schema.Types.ObjectId,
      ref: "Sport",
      required: [true, "Sport is required"],
      index: true,
    },
    teamA: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },
    teamB: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },
    originatingInvitation: {
      type: Schema.Types.ObjectId,
      ref: "Invitation",
      default: null,
    },
    matchFormat: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledAt: {
      type: Date,
      required: [true, "scheduledAt timestamp is required"],
      index: true,
    },
    durationMinutes: {
      type: Number,
      default: 60,
    },
    venue: {
      name: { type: String, default: "" },
      coordinates: { type: [Number], default: undefined },
      city: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    scorekeeper: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "proposed",
        "scheduled",
        "live",
        "pending_verification",
        "completed",
        "cancelled",
        "disputed",
        "forfeited",
      ],
      default: "scheduled",
      index: true,
    },
    scoreSummary: {
      type: Schema.Types.Mixed,
      default: {},
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    verificationData: {
      teamAConfirmed: { type: Boolean, default: false },
      teamAConfirmedAt: { type: Date, default: null },
      teamBConfirmed: { type: Boolean, default: false },
      teamBConfirmedAt: { type: Date, default: null },
      resultVersion: { type: Number, default: 1 },
    },
    verifiedResult: {
      type: Schema.Types.Mixed,
      default: null,
    },
    disputeData: {
      disputedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: null },
      disputedAt: { type: Date, default: null },
      resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      resolution: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
matchSchema.index({ status: 1, scheduledAt: 1 });
matchSchema.index({ teamA: 1, teamB: 1 });

export const Match = mongoose.model("Match", matchSchema);
export default Match;

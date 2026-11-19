import mongoose, { Schema } from "mongoose";

const matchParticipantSchema = new Schema(
  {
    match: {
      type: Schema.Types.ObjectId,
      ref: "Match",
      required: [true, "Match reference is required"],
      index: true,
    },
    authUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    side: {
      type: String,
      enum: ["teamA", "teamB"],
      required: true,
    },
    status: {
      type: String,
      enum: ["confirmed", "substituted", "no_show"],
      default: "confirmed",
    },
    stats: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate participation of the same player in a single match (Section 53)
matchParticipantSchema.index({ match: 1, authUser: 1 }, { unique: true });

export const MatchParticipant = mongoose.model("MatchParticipant", matchParticipantSchema);
export default MatchParticipant;

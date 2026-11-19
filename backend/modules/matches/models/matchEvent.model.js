import mongoose, { Schema } from "mongoose";

const matchEventSchema = new Schema(
  {
    match: {
      type: Schema.Types.ObjectId,
      ref: "Match",
      required: [true, "Match reference is required"],
      index: true,
    },
    sport: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    side: {
      type: String,
      enum: ["teamA", "teamB"],
      required: true,
    },
    player: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    eventData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serverTimestamp: {
      type: Date,
      default: Date.now,
    },
    clientEventId: {
      type: String,
      unique: true,
      sparse: true, // Idempotent event duplicate prevention
    },
    correctionReference: {
      type: Schema.Types.ObjectId,
      ref: "MatchEvent",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

matchEventSchema.index({ match: 1, serverTimestamp: 1 });

export const MatchEvent = mongoose.model("MatchEvent", matchEventSchema);
export default MatchEvent;

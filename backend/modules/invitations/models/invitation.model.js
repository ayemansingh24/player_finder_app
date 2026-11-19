import mongoose, { Schema } from "mongoose";

const invitationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["player_match", "team_membership", "team_challenge"],
      required: [true, "Invitation type is required"],
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"],
    },
    receiverUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    senderTeam: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    receiverTeam: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    matchId: {
      type: Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },
    sport: {
      type: Schema.Types.ObjectId,
      ref: "Sport",
      default: null,
    },
    proposedArrangement: {
      scheduledAt: { type: Date, default: null },
      durationMinutes: { type: Number, default: null },
      venue: { type: String, default: null },
      position: { type: String, default: null },
      matchFormat: { type: String, default: null },
    },
    message: {
      type: String,
      maxlength: [500, "Message cannot exceed 500 characters"],
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired", "cancelled"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
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

// --- Indexes ---

// Query received invitations by status/type
invitationSchema.index({ receiverUser: 1, status: 1, type: 1 });

// Query sent invitations by status
invitationSchema.index({ sender: 1, status: 1 });

// TTL reference index (actual TTL managed by background job/cron)
invitationSchema.index({ expiresAt: 1 });

// Unique partial index — prevents duplicate pending invitations of the same type
// between the same sender/receiver/team combination
invitationSchema.index(
  { sender: 1, receiverUser: 1, type: 1, teamId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "unique_pending_invitation",
  }
);

export const Invitation = mongoose.model("Invitation", invitationSchema);

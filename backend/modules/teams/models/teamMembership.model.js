import mongoose, { Schema } from "mongoose";

const teamMembershipSchema = new Schema(
  {
    team: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Team reference is required"],
      index: true,
    },
    authUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    role: {
      type: String,
      enum: ["captain", "vice_captain", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["confirmed", "pending", "inactive"],
      default: "confirmed",
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Unique team-user relationship (Section 44)
teamMembershipSchema.index({ team: 1, authUser: 1 }, { unique: true });

// Index for listing a user's active teams
teamMembershipSchema.index({ authUser: 1, status: 1 });

export const TeamMembership = mongoose.model("TeamMembership", teamMembershipSchema);
export default TeamMembership;

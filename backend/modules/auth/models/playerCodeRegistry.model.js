import mongoose, { Schema } from "mongoose";

const playerCodeRegistrySchema = new Schema(
  {
    playerCode: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      match: [/^[1-9][0-9]{6,9}$/, "Player Code must be 7–10 digits with no leading zero"],
      index: true,
    },
    allocatedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const PlayerCodeRegistry =
  mongoose.models.PlayerCodeRegistry ||
  mongoose.model("PlayerCodeRegistry", playerCodeRegistrySchema);

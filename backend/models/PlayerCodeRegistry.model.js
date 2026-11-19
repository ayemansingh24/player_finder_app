import mongoose, { Schema } from "mongoose";

/**
 * PlayerCodeRegistry — permanent record of every allocated player code.
 * Codes are NEVER reassigned, even if the user is deleted.
 */
const playerCodeRegistrySchema = new Schema({
  playerCode: {
    type: String,
    required: [true, "Player code is required"],
    unique: true,
    trim: true,
  },
  allocatedAt: {
    type: Date,
    required: true,
    default: () => new Date(),
  },
});

export const PlayerCodeRegistry = mongoose.model(
  "PlayerCodeRegistry",
  playerCodeRegistrySchema
);

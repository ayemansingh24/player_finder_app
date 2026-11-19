import mongoose, { Schema } from "mongoose";

const positionSubSchema = new Schema(
  {
    value: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const sportSchema = new Schema(
  {
    slug: {
      type: String,
      required: [true, "Sport slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Sport name is required"],
      trim: true,
    },
    hasPositions: {
      type: Boolean,
      required: true,
      default: false,
    },
    positions: {
      type: [positionSubSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Sport = mongoose.model("Sport", sportSchema);

import mongoose, { Schema } from "mongoose";

const teamSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      maxlength: [60, "Team name cannot exceed 60 characters"],
      index: true,
    },
    sport: {
      type: Schema.Types.ObjectId,
      ref: "Sport",
      required: [true, "Sport is required"],
      index: true,
    },
    captain: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Captain is required"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    logo: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    type: {
      type: String,
      enum: ["temporary", "permanent"],
      default: "permanent",
      index: true,
    },
    preferredPlayingLocation: {
      geo: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
          validate: {
            validator: (c) =>
              Array.isArray(c) &&
              c.length === 2 &&
              c[0] >= -180 &&
              c[0] <= 180 &&
              c[1] >= -90 &&
              c[1] <= 90,
            message: "Coordinates must be [longitude, latitude]",
          },
        },
      },
      venueName: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
    },
    h3Cells: {
      res7: { type: String, index: true, default: null },
      res8: { type: String, index: true, default: null },
    },
    matchFormats: {
      type: [String],
      default: [],
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    challengeEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "disbanded"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Geospatial 2dsphere index for Discovery
teamSchema.index({ "preferredPlayingLocation.geo": "2dsphere" });

// Discovery compound indexes
teamSchema.index({ sport: 1, status: 1, challengeEnabled: 1, "h3Cells.res7": 1 });
teamSchema.index({ sport: 1, status: 1, challengeEnabled: 1, "h3Cells.res8": 1 });

export const Team = mongoose.model("Team", teamSchema);
export default Team;

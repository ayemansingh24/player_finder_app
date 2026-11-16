import dotenv from "dotenv";
dotenv.config();

export const H3_CONFIG = {
  // Resolution 8 corresponds to ~461 meters edge length, ideal for local match radius
  DEFAULT_RESOLUTION: parseInt(process.env.H3_RESOLUTION, 10) || 8,
  MIN_RESOLUTION: 0,
  MAX_RESOLUTION: 15,
};

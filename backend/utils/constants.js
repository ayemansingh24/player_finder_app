export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

export const SUPPORTED_SPORTS = [
  "cricket",
  "football",
  "badminton",
  "basketball",
  "tennis",
  "padel",
  "volleyball",
  "table_tennis",
  "squash",
  "swimming",
];

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"];

export const AVAILABILITY_STATUSES = ["available", "busy", "offline"];

export const COOKIE_CONFIG = {
  ACCESS_TOKEN_NAME: "accessToken",
  REFRESH_TOKEN_NAME: "refreshToken",
  // Match JWT lifetimes
  ACCESS_TOKEN_MAX_AGE: 24 * 60 * 60 * 1000,      // 1 day
  REFRESH_TOKEN_MAX_AGE: 10 * 24 * 60 * 60 * 1000, // 10 days
};

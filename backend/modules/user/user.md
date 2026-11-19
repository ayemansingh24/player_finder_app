# User Module Documentation — Player Profile & Exact Player Code Search

## 1. Purpose
The User Module manages player profiles, preferred playing locations (GeoJSON + dual H3 cells), registered sports, availability preferences, avatar uploads, and exact Player Code lookups.

## 2. Updated Identity & Lookup Architecture (Section 16)
- **Manual Search by Player Code**: Friend and teammate lookups use exact numeric Player Codes instead of globally unique usernames.
- **Normalizing `#` Prefix**: Allows queries like `?playerCode=#7281946` or `?playerCode=7281946`.
- **Redis Rate Limiting**: Strict sliding-window rate limit (20 req/min) prevents brute-force enumeration attacks across numeric codes.
- **Sport-Specific Statistics**: `GET /api/v1/users/:userId/sports/:sportSlug/stats` returns registered positions, experience ratings, and verified match records.

## 3. Folder Structure
```text
modules/user/
  controllers/
    user.controller.js
  models/
    userProfile.model.js
  services/
    user.service.js
  validations/
    user.validation.js
  routes/
    user.routes.js
  user.md
```

## 4. Models
- `UserProfile`:
  - `authUser`: ObjectId ref `User` (unique)
  - `displayName`: String
  - `bio`, `preferredLanguage`
  - `avatar`: `{ url, publicId }`
  - `location`:
    - `geo`: `{ type: "Point", coordinates: [lng, lat] }`
    - `city`, `state`, `country`
    - `isSharingEnabled`: Boolean
  - `h3Cells`: `{ res7: String, res8: String }`
  - `h3Index`: String (legacy fallback)
  - `availability`: Full 5-tier availability configuration
  - `preferences`: `{ searchRadiusKm, notificationsEnabled, matchInvitationsEnabled }`
  - `onboardingCompleted`: Boolean

## 5. Controllers
- `getMyProfile`: Returns own profile with registered sports and Player Code.
- `updateProfile`: Updates permitted bio, displayName, language.
- `updateLocation`: Sets preferred playing location and recomputes dual H3 cells server-side.
- `updateAvailability`: Updates availability preferences.
- `updatePreferences`: Updates search radius and notification toggles.
- `updateAvatar`: Cloudinary upload.
- `searchByPlayerCode`: Exact Player Code lookup with Redis rate limiting.
- `getPublicProfile`: Sanitized public profile.
- `getPlayerSportStats`: Sport-specific positions and verified statistics.

## 6. APIs
- `GET    /api/v1/users/me` — Own profile
- `PATCH  /api/v1/users/me` — Update profile
- `PATCH  /api/v1/users/me/location` — Update location
- `PATCH  /api/v1/users/me/availability` — Update availability
- `PATCH  /api/v1/users/me/preferences` — Update preferences
- `POST   /api/v1/users/me/avatar` — Upload avatar
- `GET    /api/v1/users/search?playerCode=XXXXXXX` — Search by Player Code
- `GET    /api/v1/users/:userId/public-profile` — View another player
- `GET    /api/v1/users/:userId/sports/:sportSlug/stats` — View sport stats

## 7. Security and Privacy
- Exact coordinates and private H3 cells are stripped from public responses.
- Player Code search is authenticated and rate limited to protect user privacy.

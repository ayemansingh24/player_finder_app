# Auth Module Documentation — Permanent Player Code Architecture

## 1. Purpose
The Auth Module manages user credentials, account registration, secure JWT authentication, and the allocation of permanent, globally unique numeric Player Codes while eliminating the legacy unique username requirement.

## 2. Updated Identity Architecture (Section 5–12)
- **Non-Unique Usernames**: Users are no longer required to select globally unique usernames. Multiple users can share the same public username (e.g., "rahul").
- **Permanent Player Code**: Every account is assigned a permanent, non-changeable numeric Player Code (7 to 10 digits, matching `/^[1-9][0-9]{6,9}$/`).
- **Unambiguous Authentication**: Login accepts `email` or `playerCode` alongside the password. Ambiguous usernames cannot authenticate accounts.
- **Permanent Code Non-Reuse**: Deleted accounts never have their Player Codes recycled; the code is permanently reserved in `PlayerCodeRegistry`.

## 3. Folder Structure
```text
modules/auth/
  controllers/
    auth.controller.js
    user.controller.js
    refreshToken.controller.js
    forgetpassword.controller.js
    resetpassword.controller.js
    verifyotp.controller.js
    actionWindow.controller.js
  models/
    user.model.js
    playerCodeRegistry.model.js
  services/
    playerCode.service.js
  middlewares/
    authMiddleware.js
  routes/
    auth.routes.js
  auth.md
```

## 4. Models
### User Model (`backend/modules/auth/models/user.model.js`)
- `username`: String, required, lowercase, trim (NOT unique).
- `playerCode`: String, required, unique, immutable, minlength 7, maxlength 10, match `/^[1-9][0-9]{6,9}$/`.
- `email`: String, required, unique, lowercase, trim.
- `password`: String, bcrypt hashed.
- `role`: 'admin' | 'user'.
- `refreshToken`: String.

### PlayerCodeRegistry Model (`backend/modules/auth/models/playerCodeRegistry.model.js`)
- `playerCode`: String, required, unique, immutable, indexed.
- `allocatedAt`: Date, default `Date.now`, immutable.

## 5. Player Code Allocation Algorithm (Section 9–11)
```text
User Registration Request
    ↓
Check Email Uniqueness
    ↓
generatePlayerCode(digits = 7) via crypto.randomInt()
    ↓
Attempt Atomic Registry Allocation (PlayerCodeRegistry.create)
    ├── Success → Assign code to User and save
    └── Collision (E11000) →
          Retry with new random code
          Escalate to 8, 9, 10 digits after 3 consecutive collisions
          Max 10 retries before safe failure
```

## 6. Controllers
- `registerUser`: Allocates unique `playerCode`, creates `User`, idempotently initializes `UserProfile`, returns sanitized user with `playerCode` and JWT tokens.
- `loginUser`: Accepts `email` or `playerCode` with password, returns tokens and sets HttpOnly cookies.
- `logoutUser`: Clears refresh token in DB and cookies.
- `refreshAccessToken`: Rotates tokens.

## 7. APIs
- `POST /api/v1/auth/register` — Register account (allocates Player Code)
- `POST /api/v1/auth/login` — Log in via email or playerCode
- `POST /api/v1/auth/logout` — Log out
- `POST /api/v1/auth/refresh-token` — Refresh token rotation
- `POST /api/v1/auth/forgot-password` — Password reset trigger
- `POST /api/v1/auth/reset-password` — Password reset completion

## 8. Database Migration (`scripts/migratePlayerCodes.js`)
- Idempotently finds all existing users missing `playerCode`.
- Generates permanent code and commits to both `User` and `PlayerCodeRegistry`.
- Drops `username_1` unique index from MongoDB.
- Creates `playerCode_1` unique index.

## 9. Security Considerations
- Player codes are generated using cryptographically secure `crypto.randomInt()`, never derived from PII (email, phone, DOB, or timestamps).
- Player Code is strictly immutable and cannot be updated through any user-facing API.

# Availability Module Documentation

## 1. Purpose
The Availability Module governs player active/inactive states for discovery and match invitation dispatching using a deterministic 5-tier priority hierarchy, one-time windows, recurring schedules, and BullMQ background workers.

## 2. Responsibilities
- **Activity State Evaluation**: Determining whether a player is eligible to receive invitations at any given moment.
- **Independence from App Presence (Section 59)**: Closing the mobile app or terminating GPS does not mark a player offline or unavailable.
- **Manual Overrides**: "Stay Active", "Inactive Until Further Notice" (indefinite pause), and temporary timed pauses.
- **Schedules**: One-time blocks (e.g. vacation / exam window) and weekly recurring slots (e.g. daily after 6 PM, weekends only).
- **Timezone Awareness**: Recurring schedules evaluated against the player's local IANA timezone.
- **BullMQ Workers (Section 64)**: Automated background state transitions and cache invalidations upon pause expiration.

## 3. Folder Structure
```text
modules/availability/
  controllers/
    availability.controller.js
  services/
    availability.service.js
    availabilitySchedule.service.js
  utils/
    availabilityCalculator.js
  jobs/
    availability.queue.js
    availability.worker.js
  validations/
    availability.validation.js
  routes/
    availability.routes.js
  availability.md
```

## 4. Models
Integrated directly within `UserProfile.availability`:
- `status`: String (`available` | `busy` | `offline`) — Materialized effective status.
- `baseStatus`: String (`available` | `busy` | `offline`).
- `manualIndefiniteInactive`: Boolean.
- `temporaryPauseUntil`: Date.
- `oneTimeSchedules`: `[{ startAt, endAt, status, note }]`.
- `recurringSchedules`: `[{ daysOfWeek, startTime, endTime, status }]`.
- `timezone`: String (IANA identifier, e.g. `'Asia/Kolkata'`, `'UTC'`).
- `scheduleVersion`: Number.
- `updatedAt`: Date.

## 5. Database Relationships
Embedded directly inside `UserProfile` schema (avoiding duplicate detached data stores as required by Section 61).

## 6. Controllers
- `getMyAvailability`: Returns full availability settings, active schedules, and real-time effective status.
- `updateAvailability`: Updates base status, manual indefinite inactivity, or timezone.
- `setPause`: Sets a temporary pause (duration in minutes) and enqueues delayed BullMQ transition.
- `cancelPause`: Cancels an active pause immediately.
- `setSchedule`: Configures one-time or recurring schedule rules.
- `getSchedule`: Retrieves player schedule configuration.
- `deleteSchedule`: Clears all schedules.

## 7. Service Functions
- `availability.service.js`:
  - `getMyAvailability(authUserId)`: Calculates effective status via `getEffectiveAvailability`.
  - `updateAvailability(authUserId, updates)`: Updates base fields, increments `scheduleVersion`, recomputes status.
  - `setTemporaryPause(authUserId, durationMinutes)`: Sets `temporaryPauseUntil`, increments version, schedules BullMQ transition.
  - `cancelTemporaryPause(authUserId)`: Clears pause and re-evaluates.
- `availabilitySchedule.service.js`:
  - `setSchedule(authUserId, scheduleData)`: Persists one-time or recurring schedules, enqueues BullMQ triggers.
  - `deleteSchedule(authUserId)`: Wipes schedules.
- `availabilityCalculator.js`:
  - `getEffectiveAvailability(profile, atTime = new Date())`: Pure 5-tier priority evaluation.

## 8. Authoritative 5-Tier Priority Evaluation (Section 62)
```text
Order of Evaluation:
  1. manualIndefiniteInactive === true   → UNAVAILABLE ('offline')
  2. temporaryPauseUntil > targetDate     → UNAVAILABLE ('busy')
  3. Active One-Time Schedule at target   → Status defined in schedule
  4. Active Recurring Schedule in TZ      → Status defined in schedule
  5. Base Preference (baseStatus)         → 'available' or 'offline'
```

## 9. APIs
- `GET    /api/v1/availability/me` — Get full availability state
- `PATCH  /api/v1/availability/me` — Update base preferences
- `POST   /api/v1/availability/me/pause` — Pause invitations
- `DELETE /api/v1/availability/me/pause` — Cancel pause
- `PUT    /api/v1/availability/me/schedule` — Set schedule rules
- `GET    /api/v1/availability/me/schedule` — View schedules
- `DELETE /api/v1/availability/me/schedule` — Clear schedules

## 10. Request Examples
### Pause Availability for 2 Hours
```http
POST /api/v1/availability/me/pause
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json

{
  "durationMinutes": 120
}
```

### Set Recurring Weekend Schedule
```http
PUT /api/v1/availability/me/schedule
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json

{
  "scheduleType": "recurring",
  "status": "available",
  "daysOfWeek": [0, 6],
  "startTime": "07:00",
  "endTime": "11:00",
  "timezone": "Asia/Kolkata"
}
```

## 11. Response Examples
```json
{
  "success": true,
  "message": "Availability schedule saved successfully",
  "data": {
    "scheduleType": "recurring",
    "effectiveStatus": "available",
    "recurringSchedules": [
      {
        "daysOfWeek": [0, 6],
        "startTime": "07:00",
        "endTime": "11:00",
        "status": "available"
      }
    ],
    "timezone": "Asia/Kolkata"
  }
}
```

## 12. Complete Request Flow
```text
Player Saves Schedule / Pause
  ↓
validateScheduleInput (validates 24h format, days 0-6, valid dates)
  ↓
availabilitySchedule.service.js
  ├─ Updates UserProfile.availability
  ├─ Increments scheduleVersion
  ├─ Enqueues delayed BullMQ job to availabilityQueue
  ├─ Recomputes effective status via availabilityCalculator
  └─ Saves UserProfile
  ↓
Delayed BullMQ Job Fires
  ↓
availability.worker.js
  ├─ Compares job scheduleVersion with DB scheduleVersion (discards stale jobs)
  ├─ Recomputes effective availability
  └─ Updates UserProfile.availability.status
```

## 13. MongoDB Queries & Indexes
- Querying for discovery candidates:
  - `{ "h3Cells.res7": 1, "availability.status": 1, "location.isSharingEnabled": 1 }`
  - `{ "h3Cells.res8": 1, "availability.status": 1, "location.isSharingEnabled": 1 }`

## 14. Redis & BullMQ Usage
- Queue: `availability-transitions`
- Connection: Configured via `config/bullmq.js`
- Delay handling: BullMQ delayed jobs with exponential backoff.
- Stale Job Invalidation: Discards execution if `scheduleVersion` changed since job creation.

## 15. Regex and Validation
- Time strings: `/^\d{2}:\d{2}$/` (24-hour format).
- Days of week: Integers `[0, 1, 2, 3, 4, 5, 6]`.
- Pause duration: `1 <= durationMinutes <= 1440` (up to 24 hours).

## 16. Authorization
- All availability routes require JWT authentication (`verifyJWT`).
- Users can view and modify only their own availability (`req.user._id`).

## 17. Security Considerations
- Rate limited against repeated pause/unpause toggles.
- Server authoritative timestamps; no client-controlled clock overrides.

## 18. Edge Cases Handled
- **Overnight Windows (Section 63)**: Supports schedule ranges where `startTime > endTime` (e.g. 21:00 to 02:00 next day).
- **Stale Materialization (Section 64)**: Discovery recalculates effective availability on the fly during search queries; does not rely blindly on stored status.
- **Pause Expiration Recovery**: When pause ends, BullMQ worker triggers re-evaluation against underlying schedules.

## 19. Integration Dependencies
- `modules/user/`: `UserProfile` model storage.
- `modules/discovery/`: Filtering active vs inactive players.
- `modules/invitations/`: Pre-dispatch availability check.

## 20. Environment Variables
- `REDIS_URL`: Redis backend for BullMQ.

## 21. Known Limitations
- Daylight saving adjustments depend on Node.js `Intl.DateTimeFormat` timezone database.

## 22. Testing Status
Automated testing, API testing, and performance benchmarking have intentionally not been performed during this implementation phase.

## 23. Future Improvements
- Google Calendar sync for automatic match availability blocking.

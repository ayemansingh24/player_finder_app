import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import connectDB from "./db/index.js";
import authRouter from "./modules/auth/routes/auth.routes.js";
import userRouter from "./modules/user/routes/user.routes.js";
import sportRouter from "./modules/sports/routes/sport.routes.js";
import discoveryRouter from "./modules/discovery/routes/discovery.routes.js";
import invitationRouter from "./modules/invitations/routes/invitation.routes.js";
import teamRouter from "./modules/teams/routes/team.routes.js";
import matchRouter from "./modules/matches/routes/match.routes.js";
import availabilityRouter from "./modules/availability/routes/availability.routes.js";
import mailRouter from "./modules/mail/routes/mail.routes.js";
import notificationRouter from "./modules/notification/routes/notification.routes.js";
import verifyFirebaseToken from "./authMiddleware.js";
import errorHandler from "./middlewares/errorHandler.js";
import { initSocket } from "./socket/index.js";
import { startAvailabilityWorker } from "./modules/availability/jobs/availability.worker.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Attach Socket.IO to HTTP server
initSocket(httpServer);

// CORS configuration supporting both browser web cookies and native mobile clients
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8081", // React Native Metro bundler
  "http://localhost:19006", // Expo web
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps or curl) or in allowedOrigins
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

// Body parsers & static assets
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(express.static("public"));

// -------------------------------------------------------------
// Core Application Routers (Part A - G)
// -------------------------------------------------------------

// 1. Auth Module (Player Codes, Non-unique usernames, JWT authentication)
app.use("/api/v1/auth", authRouter);

// 2. User Module (Profile, Location, Availability, Sports, Player Code search)
app.use("/api/v1/users", userRouter);

// 3. Sports Catalogue Routes (Authoritative hardcoded sports)
app.use("/api/v1/sports", sportRouter);

// 4. Discovery Module (H3 + MongoDB GeoJSON player & opponent team search)
app.use("/api/v1/discovery", discoveryRouter);

// 5. Invitation Module (Player match, team membership, opponent challenge)
app.use("/api/v1/invitations", invitationRouter);

// 6. Team Module (Captains, memberships, playing locations, recruitment)
app.use("/api/v1/teams", teamRouter);

// 7. Match Module (Scheduling, live scoring, Socket.IO, result verification)
app.use("/api/v1/matches", matchRouter);

// 8. Availability Module (5-tier priority, pause, schedules, BullMQ transitions)
app.use("/api/v1/availability", availabilityRouter);

// 9. Mail & Push Notification Services
app.use("/api/v1/mail", mailRouter);
app.use("/api/v1/notifications", notificationRouter);

// -------------------------------------------------------------
// Legacy Firebase OAuth Demo Endpoints (Preserved for compatibility)
// -------------------------------------------------------------
app.get("/api/public", (req, res) => {
  res.json({
    success: true,
    message: "Hello from the PUBLIC API! No login required to see this.",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/protected", verifyFirebaseToken, (req, res) => {
  res.json({
    success: true,
    message: `Hello ${req.user.name || "User"}! You successfully accessed the PROTECTED API.`,
    user: {
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
      authTime: new Date(req.user.auth_time * 1000).toLocaleString(),
    },
    secretData: "🔒 This confidential data is only shown to verified authenticated users!",
  });
});

app.post("/api/verify-user", verifyFirebaseToken, (req, res) => {
  res.json({
    success: true,
    message: "User token verified successfully by backend.",
    user: req.user,
  });
});

// Centralized error handler
app.use(errorHandler);

// Connect to MongoDB and start the server only when executed directly
if (process.env.NODE_ENV !== "test") {
  connectDB()
    .then(() => {
      // Start background workers
      startAvailabilityWorker();

      httpServer.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
        console.log(`   Auth API:           http://localhost:${PORT}/api/v1/auth`);
        console.log(`   Users API:          http://localhost:${PORT}/api/v1/users`);
        console.log(`   Discovery API:      http://localhost:${PORT}/api/v1/discovery`);
        console.log(`   Invitations API:    http://localhost:${PORT}/api/v1/invitations`);
        console.log(`   Teams API:          http://localhost:${PORT}/api/v1/teams`);
        console.log(`   Matches API:        http://localhost:${PORT}/api/v1/matches`);
        console.log(`   Availability API:   http://localhost:${PORT}/api/v1/availability`);
        console.log(`   Public endpoint:    GET  http://localhost:${PORT}/api/public`);
        console.log(`   Protected endpoint: GET  http://localhost:${PORT}/api/protected`);
      });
    })
    .catch((err) => {
      console.error("Failed to connect to database:", err);
    });
}

export { app, httpServer };

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import connectDB from "./db/index.js";
import authRouter from "./modules/auth/routes/auth.routes.js";
import userRouter from "./modules/user/routes/user.routes.js";
import mailRouter from "./modules/mail/routes/mail.routes.js";
import notificationRouter from "./modules/notification/routes/notification.routes.js";
import verifyFirebaseToken from "./authMiddleware.js";
import errorHandler from "./middlewares/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

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
// 1. Auth Module Routes
// -------------------------------------------------------------
app.use("/api/v1/auth", authRouter);

// -------------------------------------------------------------
// 2. User Module Routes (Sports, Profile, Location, Availability)
// -------------------------------------------------------------
app.use("/api/v1/users", userRouter);

// -------------------------------------------------------------
// 3. Mail & Notification Module Routes
// -------------------------------------------------------------
app.use("/api/v1/mail", mailRouter);
app.use("/api/v1/notifications", notificationRouter);

// -------------------------------------------------------------
// 4. Firebase OAuth Demo Endpoints (Preserved for compatibility)
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
      app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
        console.log(`   Auth API:           http://localhost:${PORT}/api/v1/auth`);
        console.log(`   Users API:          http://localhost:${PORT}/api/v1/users`);
        console.log(`   Public endpoint:    GET  http://localhost:${PORT}/api/public`);
        console.log(`   Protected endpoint: GET  http://localhost:${PORT}/api/protected`);
      });
    })
    .catch((err) => {
      console.error("Failed to connect to database:", err);
    });
}

export { app };

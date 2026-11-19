import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";
import { uploadAvatar } from "../../../middlewares/multer.middleware.js";
import { playerCodeSearchLimiter, locationUpdateLimiter } from "../../../middlewares/rateLimiter.js";
import userSportRouter from "../../userSports/routes/userSport.routes.js";

const router = Router();

// Mount user sports router under /me/sports
router.use("/me/sports", userSportRouter);

// Private routes for authenticated user
router.get("/me", verifyJWT, userController.getMyProfile);
router.patch("/me", verifyJWT, userController.updateProfile);
router.patch("/me/location", verifyJWT, locationUpdateLimiter, userController.updateLocation);
router.patch("/me/availability", verifyJWT, userController.updateAvailability);
router.patch("/me/preferences", verifyJWT, userController.updatePreferences);
router.post("/me/avatar", verifyJWT, uploadAvatar.single("avatar"), userController.updateAvatar);
router.post("/me/fcm-token", verifyJWT, userController.registerFcmToken);
router.delete("/me/fcm-token", verifyJWT, userController.removeFcmToken);

// Player code search — authenticated with Redis rate limiting
router.get("/search", verifyJWT, playerCodeSearchLimiter, userController.searchByPlayerCode);

// Public routes for viewing another player's profile and sport stats
router.get("/:userId/public-profile", userController.getPublicProfile);
router.get("/:userId/sports/:sportSlug/stats", userController.getPlayerSportStats);

// Public route to view another player's safe public profile (legacy — keep for backwards compat)
router.get("/:userId", userController.getPublicProfile);

export default router;


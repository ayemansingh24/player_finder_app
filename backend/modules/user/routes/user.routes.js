import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";
import { uploadAvatar } from "../../../middlewares/multer.middleware.js";

const router = Router();

// Private routes for authenticated user
router.get("/me", verifyJWT, userController.getMyProfile);
router.patch("/me", verifyJWT, userController.updateProfile);
router.put("/me/sports", verifyJWT, userController.updateSports);
router.delete("/me/sports/:sport", verifyJWT, userController.removeSport);
router.patch("/me/location", verifyJWT, userController.updateLocation);
router.patch("/me/availability", verifyJWT, userController.updateAvailability);
router.patch("/me/preferences", verifyJWT, userController.updatePreferences);
router.post("/me/avatar", verifyJWT, uploadAvatar.single("avatar"), userController.updateAvatar);
router.post("/me/fcm-token", verifyJWT, userController.registerFcmToken);
router.delete("/me/fcm-token", verifyJWT, userController.removeFcmToken);

// Public route to view another player's safe public profile
router.get("/:userId", userController.getPublicProfile);

export default router;

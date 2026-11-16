import { Router } from "express";
import * as notificationController from "../controllers/notification.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";

const router = Router();

// Test dispatch endpoint
router.post("/test", notificationController.sendTestNotification);

// Send alert to specific user (requires authentication)
router.post("/user-alert", verifyJWT, notificationController.sendUserAlert);

export default router;

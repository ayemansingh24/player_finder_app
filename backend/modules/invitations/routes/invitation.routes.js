import { Router } from "express";
import * as invitationController from "../controllers/invitation.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";
import { invitationCreationLimiter } from "../../../middlewares/rateLimiter.js";

const router = Router();

// All invitation endpoints require JWT authentication
router.use(verifyJWT);

router.post("/", invitationCreationLimiter, invitationController.createInvitation);
router.get("/received", invitationController.getReceivedInvitations);
router.get("/sent", invitationController.getSentInvitations);
router.get("/:id", invitationController.getInvitationById);
router.patch("/:id/accept", invitationController.acceptInvitation);
router.patch("/:id/reject", invitationController.rejectInvitation);
router.patch("/:id/cancel", invitationController.cancelInvitation);

export default router;

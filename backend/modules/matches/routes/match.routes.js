import { Router } from "express";
import * as matchController from "../controllers/match.controller.js";
import * as scoreController from "../controllers/matchScore.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";

const router = Router();

// All match operations require JWT authentication
router.use(verifyJWT);

// Static routes MUST be declared before parameter routes (Section 58)
router.post("/", matchController.createMatch);
router.get("/my-matches", matchController.getMyMatches);

// Parameter routes
router.get("/:matchId", matchController.getMatchById);
router.patch("/:matchId/schedule", matchController.scheduleMatch);
router.post("/:matchId/start", matchController.startMatch);
router.post("/:matchId/events", scoreController.recordEvent);
router.get("/:matchId/score", scoreController.getLiveScore);
router.post("/:matchId/end", matchController.endMatch);
router.post("/:matchId/confirm-result", matchController.confirmResult);
router.post("/:matchId/dispute-result", matchController.disputeResult);
router.post("/:matchId/resolve-dispute", matchController.resolveDispute);

export default router;

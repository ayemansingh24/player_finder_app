import { Router } from "express";
import * as discoveryController from "../controllers/discovery.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";
import { playerDiscoveryLimiter, teamDiscoveryLimiter } from "../../../middlewares/rateLimiter.js";

const router = Router();

// Discovery routes require JWT authentication
router.use(verifyJWT);

router.post("/players/search", playerDiscoveryLimiter, discoveryController.searchPlayers);
router.post("/teams/search", teamDiscoveryLimiter, discoveryController.searchTeams);

export default router;

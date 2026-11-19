import { Router } from "express";
import * as userSportController from "../controllers/userSport.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";

const router = Router();

// All user sports endpoints require valid JWT authentication
router.use(verifyJWT);

router.get("/", userSportController.getMySports);
router.post("/", userSportController.addSport);
router.patch("/:sportSlug", userSportController.updateSport);
router.delete("/:sportSlug", userSportController.deleteSport);

export default router;

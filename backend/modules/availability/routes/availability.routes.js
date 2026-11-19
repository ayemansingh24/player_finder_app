import { Router } from "express";
import * as availabilityController from "../controllers/availability.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";

const router = Router();

// All availability routes require authentication
router.use(verifyJWT);

router.get("/me", availabilityController.getMyAvailability);
router.patch("/me", availabilityController.updateAvailability);
router.post("/me/pause", availabilityController.setPause);
router.delete("/me/pause", availabilityController.cancelPause);
router.put("/me/schedule", availabilityController.setSchedule);
router.get("/me/schedule", availabilityController.getSchedule);
router.delete("/me/schedule", availabilityController.deleteSchedule);

export default router;

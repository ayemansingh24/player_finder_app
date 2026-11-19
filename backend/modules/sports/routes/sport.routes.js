import { Router } from "express";
import * as sportController from "../controllers/sport.controller.js";

const router = Router();

// Public sports catalogue endpoints
router.get("/", sportController.getAllSports);
router.get("/:slug", sportController.getSportBySlug);

export default router;

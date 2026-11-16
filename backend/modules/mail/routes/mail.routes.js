import { Router } from "express";
import * as mailController from "../controllers/mail.controller.js";

const router = Router();

// Test email endpoint
router.post("/test", mailController.sendTestEmail);

export default router;

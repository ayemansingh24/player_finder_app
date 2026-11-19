import { Router } from "express";
import * as mailController from "../controllers/mail.controller.js";

const router = Router();

// Firebase native email services
router.post("/reset-link", mailController.sendPasswordResetLink);
router.post("/verification-link", mailController.sendVerificationLink);
router.post("/signin-link", mailController.sendSignInLink);

// Test alias
router.post("/test", mailController.sendPasswordResetLink);

export default router;

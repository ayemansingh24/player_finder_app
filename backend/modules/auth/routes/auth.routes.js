import { Router } from "express";

import {
  registerUser,
  loginUser,
  logoutUser,
  getDashboard,
  deleteUser,
} from "../controllers/auth.controller.js";

import { verifyJWT } from "../../../middlewares/auth.middleware.js";
import { isAdmin } from "../../../middlewares/role.middleware.js";

import { forgotPassword } from "../controllers/forgetpassword.controller.js";
import { verifyOTP } from "../controllers/verifyotp.controller.js";
import { resetPassword } from "../controllers/resetpassword.controller.js";
import { refreshAccessToken } from "../controllers/refreshToken.controller.js";
import { renderActionWindow, magicLogin } from "../controllers/actionWindow.controller.js";

import {
  changePassword,
  updateAccountDetails,
  updateUserAvatar,
  deleteUserAvatar,
} from "../controllers/user.controller.js";

import { upload } from "../../../middlewares/multer.middleware.js";

const router = Router();

// Authentication Core Endpoints
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", verifyJWT, logoutUser);
router.post("/refresh-token", refreshAccessToken);

// Password Recovery & Action Portal
router.post("/forgot-password", forgotPassword);
router.get("/action", renderActionWindow);
router.post("/magic-login", magicLogin);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

// User Session & Role checks
router.get("/dashboard", verifyJWT, getDashboard);
router.get("/verify-role", verifyJWT, (req, res) => {
  return res.status(200).json({
    success: true,
    role: req.user.role,
    isAdmin: req.user.role === "admin",
    user: req.user,
  });
});

router.get("/admin/dashboard", verifyJWT, isAdmin, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Welcome to Admin Dashboard",
    role: req.user.role,
    user: req.user,
  });
});

router.get("/user/dashboard", verifyJWT, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Welcome to User Dashboard",
    role: req.user.role,
    user: req.user,
  });
});

// Legacy account maintenance endpoints (preserved for backwards compatibility)
router.post("/change-password", verifyJWT, changePassword);
router.patch("/update-account", verifyJWT, updateAccountDetails);
router.patch("/update-avatar", verifyJWT, upload.single("avatar"), updateUserAvatar);
router.delete("/delete-avatar", verifyJWT, deleteUserAvatar);
router.delete("/delete-account", verifyJWT, deleteUser);

export default router;

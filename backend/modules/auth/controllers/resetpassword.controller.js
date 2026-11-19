import { User } from "../models/user.model.js";
import { generateAccessAndRefreshTokens, getCookieOptions, isMobileClient } from "./auth.controller.js";
import { COOKIE_CONFIG } from "../../../utils/constants.js";

/**
 * POST /api/v1/auth/reset-password
 * Resets user password using either the secure link token OR legacy OTP
 */
const resetPassword = async (req, res) => {
  try {
    const { email, token, otp, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required",
      });
    }

    if (!token && !otp) {
      return res.status(400).json({
        success: false,
        message: "Either security token or OTP is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 1. Verify via Link Token
    if (token) {
      if (user.resetPasswordToken !== token) {
        return res.status(400).json({
          success: false,
          message: "Invalid or already used security token",
        });
      }

      if (!user.resetPasswordTokenExpiry || user.resetPasswordTokenExpiry < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Security link has expired. Please request a new one.",
        });
      }
    }
    // 2. Fallback: Verify via OTP
    else if (otp) {
      if (user.resetPasswordOTP !== otp) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP code",
        });
      }

      if (!user.resetPasswordOTPExpiry || user.resetPasswordOTPExpiry < new Date()) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        });
      }
    }

    // Update password (pre-save hook hashes with bcrypt automatically)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpiry = undefined;

    await user.save();

    // Log the user in directly after reset
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const updatedUser = await User.findById(user._id).select(
      "-password -refreshToken -resetPasswordOTP -resetPasswordOTPExpiry -resetPasswordToken -resetPasswordTokenExpiry"
    );

    res.cookie(COOKIE_CONFIG.ACCESS_TOKEN_NAME, accessToken, getCookieOptions("access"));
    res.cookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, refreshToken, getCookieOptions("refresh"));

    const isMobile = isMobileClient(req);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully! You are now logged in.",
      user: updatedUser,
      accessToken,
      ...(isMobile ? { refreshToken } : {}),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong while resetting password",
      error: error.message,
    });
  }
};

export { resetPassword };

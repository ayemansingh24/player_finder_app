import { User } from "../models/user.model.js";
import { sendFirebasePasswordResetEmail } from "../../mail/services/mail.service.js";

/**
 * POST /api/v1/auth/forgot-password
 * Sends official native Firebase password reset email with verification link
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email not found",
      });
    }

    // Dispatch official native Firebase email
    try {
      const result = await sendFirebasePasswordResetEmail(normalizedEmail);
      return res.status(200).json({
        success: true,
        message: "Official Firebase password reset link has been dispatched to your email.",
        result,
      });
    } catch (firebaseErr) {
      console.error("Firebase mail dispatch error:", firebaseErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to dispatch Firebase email. Please try again.",
        error: firebaseErr.message,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong while processing your request",
      error: error.message,
    });
  }
};

export { forgotPassword };

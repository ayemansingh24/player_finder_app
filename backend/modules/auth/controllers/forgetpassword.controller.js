import { User } from "../models/user.model.js";
import { sendPasswordResetEmail } from "../../../services/firebaseMail.service.js";

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User with this email not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpiry = otpExpiry;

    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail(email, otp);
    } catch (mailErr) {
      console.error("Mail send error:", mailErr.message);
      return res.status(500).json({
        message: "Failed to send OTP to your email. Please try again later.",
      });
    }

    return res.status(200).json({
      message: "OTP sent successfully to your registered email",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong while sending OTP",
      error: error.message,
    });
  }
};

export { forgotPassword };

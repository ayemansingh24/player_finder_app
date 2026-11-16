import { User } from "../models/user.model.js";
import { generateAccessAndRefreshTokens } from "./auth.controller.js";

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.resetPasswordOTP !== otp) {
      return res.status(400).json({
        message: "Invalid OTP code",
      });
    }

    if (!user.resetPasswordOTPExpiry || user.resetPasswordOTPExpiry < new Date()) {
      return res.status(400).json({
        message: "OTP has expired. Please request a new one.",
      });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const authenticatedUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    const cookieOptions = {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json({
        message: "OTP verified successfully",
        user: authenticatedUser,
        accessToken,
        refreshToken,
      });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong while verifying OTP",
      error: error.message,
    });
  }
};

export { verifyOTP };

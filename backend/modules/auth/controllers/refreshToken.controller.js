import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { getCookieOptions, isMobileClient } from "./auth.controller.js";
import { COOKIE_CONFIG } from "../../../utils/constants.js";

const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const decodedToken = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is invalid or has expired",
      });
    }

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    // Set secure HttpOnly cookies
    res.cookie(COOKIE_CONFIG.ACCESS_TOKEN_NAME, newAccessToken, getCookieOptions("access"));
    res.cookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, newRefreshToken, getCookieOptions("refresh"));

    const isMobile = isMobileClient(req);

    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      accessToken: newAccessToken,
      ...(isMobile ? { refreshToken: newRefreshToken } : {}),
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
      error: error.message,
    });
  }
};

export { refreshAccessToken };

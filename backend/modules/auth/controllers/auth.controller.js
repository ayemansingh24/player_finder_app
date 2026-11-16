import { User } from "../models/user.model.js";
import { createInitialProfile } from "../../user/services/user.service.js";
import { COOKIE_CONFIG } from "../../../utils/constants.js";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Generates cookie configuration matching JWT lifetimes
 */
export const getCookieOptions = (type = "access") => {
  const maxAge =
    type === "refresh"
      ? COOKIE_CONFIG.REFRESH_TOKEN_MAX_AGE
      : COOKIE_CONFIG.ACCESS_TOKEN_MAX_AGE;

  return {
    httpOnly: true, // Mitigate XSS attacks
    secure: isProduction, // Transmit over HTTPS only in production
    sameSite: isProduction ? "none" : "lax", // Protect against CSRF
    maxAge,
  };
};

/**
 * Checks whether the request is from a React Native mobile client
 */
export const isMobileClient = (req) => {
  const clientType = req.headers["x-client-type"] || req.headers["x-client-platform"];
  return (
    clientType === "mobile" ||
    clientType === "react-native" ||
    clientType === "expo"
  );
};

export const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new Error("Something went wrong while generating tokens");
  }
};

const registerUser = async (req, res) => {
  try {
    const { username, email, fullName, password, role } = req.body;

    if (!username || !email || !fullName || !password) {
      return res.status(400).json({
        success: false,
        message: "username, email, fullName, and password are required",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or username already exists",
      });
    }

    const user = await User.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      password,
      role: role || "user",
      avatar: {
        url: "default-avatar",
      },
    });

    // Idempotent creation of the associated UserProfile
    try {
      await createInitialProfile(user);
    } catch (profileErr) {
      console.error("Warning: Profile initialization error:", profileErr.message);
      // Non-fatal because user.service has self-healing getMyProfile fallback
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken -resetPasswordOTP -resetPasswordOTPExpiry"
    );

    // Set secure HttpOnly cookies
    res.cookie(COOKIE_CONFIG.ACCESS_TOKEN_NAME, accessToken, getCookieOptions("access"));
    res.cookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, refreshToken, getCookieOptions("refresh"));

    const isMobile = isMobileClient(req);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: createdUser,
      accessToken,
      // Only expose refreshToken in JSON body to Mobile clients (for Expo SecureStore)
      ...(isMobile ? { refreshToken } : {}),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong while registering user",
      error: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if ((!email && !username) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/username and password are required",
      });
    }

    const query = email ? { email: email.toLowerCase().trim() } : { username: username.toLowerCase().trim() };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // Ensure associated UserProfile exists (self-heal for existing accounts)
    try {
      await createInitialProfile(user);
    } catch (profileErr) {
      // Ignore if already exists
    }

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken -resetPasswordOTP -resetPasswordOTPExpiry"
    );

    res.cookie(COOKIE_CONFIG.ACCESS_TOKEN_NAME, accessToken, getCookieOptions("access"));
    res.cookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, refreshToken, getCookieOptions("refresh"));

    const isMobile = isMobileClient(req);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: loggedInUser,
      accessToken,
      // Only expose refreshToken in JSON body for React Native mobile storage
      ...(isMobile ? { refreshToken } : {}),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong while logging in",
      error: error.message,
    });
  }
};

const logoutUser = async (req, res) => {
  try {
    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { refreshToken: 1 },
      });
    }

    const clearOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    };

    res.clearCookie(COOKIE_CONFIG.ACCESS_TOKEN_NAME, clearOptions);
    res.clearCookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, clearOptions);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error during logout",
      error: error.message,
    });
  }
};

const getDashboard = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Dashboard data",
    user: req.user,
  });
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await User.findByIdAndDelete(req.user._id);

    // Clean up associated UserProfile
    const { UserProfile } = await import("../../user/models/userProfile.model.js");
    await UserProfile.findOneAndDelete({ authUser: req.user._id });

    return res.status(200).json({
      success: true,
      message: "User account and profile deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting user",
      error: error.message,
    });
  }
};

export { registerUser, loginUser, logoutUser, getDashboard, deleteUser };

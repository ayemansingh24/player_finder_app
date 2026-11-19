import { User } from "../models/user.model.js";
import { createInitialProfile } from "../../user/services/user.service.js";
import { COOKIE_CONFIG } from "../../../utils/constants.js";
import { allocatePlayerCode } from "../../../utils/playerCodeGenerator.js";
import { PlayerCodeRegistry } from "../../../models/PlayerCodeRegistry.model.js";

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

    // 1. Check for existing email (must be globally unique)
    const existingByEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingByEmail) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // 2. Allocate a unique permanent Player Code
    const playerCode = await allocatePlayerCode(User, PlayerCodeRegistry);

    // 3. Create user document with assigned Player Code
    const user = await User.create({
      username: username.toLowerCase().trim(),
      playerCode,
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      password,
      role: role || "user",
      avatar: {
        url: "default-avatar",
      },
    });

    // 4. Idempotent creation of the associated UserProfile (non-fatal)
    try {
      await createInitialProfile(user);
    } catch (profileErr) {
      console.error("Warning: Profile initialization error:", profileErr.message);
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
      playerCode: createdUser.playerCode,
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
    const { email, identifier, password } = req.body;
    const loginIdentifier = (email || identifier || "").toLowerCase().trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email (or Player Code) and password are required",
      });
    }

    // Support unambiguous identity: email or numeric playerCode.
    // Usernames are no longer unique and must never authenticate as the wrong account.
    let user;
    if (loginIdentifier.includes("@")) {
      user = await User.findOne({ email: loginIdentifier });
    } else if (/^[1-9][0-9]{6,9}$/.test(loginIdentifier)) {
      user = await User.findOne({ playerCode: loginIdentifier });
    } else {
      user = await User.findOne({ email: loginIdentifier });
    }

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

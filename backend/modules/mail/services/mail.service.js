import admin from "../../../config/firebase.js";
import dotenv from "dotenv";

dotenv.config();

const FIREBASE_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || "AIzaSyAm_3QyNgrhXUq6V57k4E_F0w7PTN6llAU";

/**
 * Ensures user exists in Firebase Authentication so Firebase can dispatch official emails
 */
const ensureFirebaseAuthUser = async (email, displayName = "Player") => {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      return await admin.auth().createUser({
        email,
        displayName,
        emailVerified: false,
      });
    }
    throw err;
  }
};

/**
 * Sends official native Firebase password reset email.
 * Firebase servers directly dispatch the email containing Google's secure action link.
 *
 * @param {string} email - Recipient email
 * @returns {Promise<{ success: boolean, email: string, method: string }>}
 */
export const sendFirebasePasswordResetEmail = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Ensure user exists in Firebase Auth
  await ensureFirebaseAuthUser(normalizedEmail);

  // 2. Dispatch via Firebase Identity Toolkit sendOobCode
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email: normalizedEmail,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to send Firebase password reset email");
  }

  console.log(`🔥 Official Firebase Password Reset email dispatched by Google to: ${normalizedEmail}`);
  return {
    success: true,
    email: normalizedEmail,
    method: "firebase_native_auth_email",
  };
};

/**
 * Sends official native Firebase email verification link.
 *
 * @param {string} email
 * @returns {Promise<{ success: boolean, email: string, method: string }>}
 */
export const sendFirebaseEmailVerification = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  await ensureFirebaseAuthUser(normalizedEmail);

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "VERIFY_EMAIL",
        email: normalizedEmail,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to send Firebase verification email");
  }

  console.log(`🔥 Official Firebase Email Verification dispatched by Google to: ${normalizedEmail}`);
  return {
    success: true,
    email: normalizedEmail,
    method: "firebase_native_verification_email",
  };
};

/**
 * Sends official native Firebase passwordless sign-in magic link.
 *
 * @param {string} email
 * @param {string} [continueUrl]
 */
export const sendFirebaseSignInLink = async (email, continueUrl = "http://localhost:5001") => {
  const normalizedEmail = email.toLowerCase().trim();
  await ensureFirebaseAuthUser(normalizedEmail);

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "EMAIL_SIGNIN",
        email: normalizedEmail,
        continueUrl,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to send Firebase sign-in link");
  }

  console.log(`🔥 Official Firebase Sign-In link dispatched by Google to: ${normalizedEmail}`);
  return {
    success: true,
    email: normalizedEmail,
    method: "firebase_native_magic_link",
  };
};

// Aliases for module consumers
export const sendPasswordResetEmail = sendFirebasePasswordResetEmail;
export const sendAccountActionEmail = sendFirebasePasswordResetEmail;
export const sendCustomEmail = sendFirebasePasswordResetEmail;

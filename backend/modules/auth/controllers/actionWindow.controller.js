import { User } from "../models/user.model.js";
import { generateAccessAndRefreshTokens, getCookieOptions, isMobileClient } from "./auth.controller.js";
import { COOKIE_CONFIG } from "../../../utils/constants.js";

/**
 * GET /api/v1/auth/action
 * Renders the clean action portal window in the browser when the user clicks the email link.
 * Gives the user two clear options:
 * 1. Directly sign in with one click
 * 2. Set / change a new password
 */
export const renderActionWindow = async (req, res) => {
  const { token, email } = req.query;

  if (!token || !email) {
    return res.status(400).send(renderErrorHtml("Missing or malformed action link. Please request a new access link."));
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || user.resetPasswordToken !== token) {
    return res.status(400).send(renderErrorHtml("This link is invalid or has already been used. Please request a new access link."));
  }

  if (!user.resetPasswordTokenExpiry || user.resetPasswordTokenExpiry < new Date()) {
    return res.status(400).send(renderErrorHtml("This link has expired for security reasons. Please request a new link to access your account."));
  }

  const displayName = user.fullName || user.username || "Player";

  // Render the modern, responsive action portal
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Access Portal - Sports Platform</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #0f172a;
          color: #f8fafc;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 16px;
          max-width: 480px;
          width: 100%;
          padding: 36px 28px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        }
        .header { text-align: center; margin-bottom: 28px; }
        .logo { font-size: 32px; margin-bottom: 8px; }
        .title { font-size: 22px; font-weight: 700; color: #ffffff; }
        .subtitle { font-size: 14px; color: #94a3b8; margin-top: 6px; }
        
        .section-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 28px 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .section-divider::before, .section-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid #334155;
        }
        .section-divider::before { margin-right: 12px; }
        .section-divider::after { margin-left: 12px; }

        .btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-magic {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
        }
        .btn-magic:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: translateY(-1px);
        }
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
          margin-top: 8px;
        }
        .btn-primary:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: translateY(-1px);
        }

        .form-group { margin-bottom: 16px; text-align: left; }
        .form-label { display: block; font-size: 13px; font-weight: 500; color: #cbd5e1; margin-bottom: 6px; }
        .form-input {
          width: 100%;
          padding: 12px 14px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #ffffff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-input:focus { border-color: #3b82f6; }

        .alert {
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
          display: none;
          line-height: 1.4;
        }
        .alert-success { background: #064e3b; color: #6ee7b7; border: 1px solid #059669; }
        .alert-error { background: #450a0a; color: #fca5a5; border: 1px solid #dc2626; }
        
        .footer-note { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">🏆</div>
          <div class="title">Welcome, ${displayName}</div>
          <div class="subtitle">${normalizedEmail}</div>
        </div>

        <div id="alertBox" class="alert"></div>

        <!-- OPTION 1: DIRECT ONE-CLICK SIGN IN -->
        <div style="background: #0f172a; border: 1px solid #334155; padding: 18px; border-radius: 12px;">
          <div style="font-size: 14px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px;">Option 1: Quick Access</div>
          <p style="font-size: 13px; color: #94a3b8; margin-bottom: 14px;">Sign in directly to your account with a single click without changing your password.</p>
          <button id="directSignInBtn" class="btn btn-magic" onclick="handleDirectSignIn()">
            ⚡ Sign In Directly
          </button>
        </div>

        <div class="section-divider">OR</div>

        <!-- OPTION 2: CHANGE / RESET PASSWORD -->
        <div style="background: #0f172a; border: 1px solid #334155; padding: 18px; border-radius: 12px;">
          <div style="font-size: 14px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px;">Option 2: Change Password</div>
          <p style="font-size: 13px; color: #94a3b8; margin-bottom: 14px;">Set a new password for future logins.</p>
          
          <form id="passwordForm" onsubmit="handlePasswordReset(event)">
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input type="password" id="newPassword" class="form-input" placeholder="Enter new password (min. 6 characters)" required minlength="6">
            </div>
            <div class="form-group">
              <label class="form-label">Confirm New Password</label>
              <input type="password" id="confirmPassword" class="form-input" placeholder="Repeat new password" required minlength="6">
            </div>
            <button type="submit" id="submitPasswordBtn" class="btn btn-primary">
              🔒 Set Password & Sign In
            </button>
          </form>
        </div>

        <div class="footer-note">
          Security protected. This access session expires in 30 minutes.
        </div>
      </div>

      <script>
        const token = "${token}";
        const email = "${normalizedEmail}";

        function showAlert(message, type = "success") {
          const alertBox = document.getElementById("alertBox");
          alertBox.className = "alert " + (type === "success" ? "alert-success" : "alert-error");
          alertBox.textContent = message;
          alertBox.style.display = "block";
        }

        async function handleDirectSignIn() {
          const btn = document.getElementById("directSignInBtn");
          btn.disabled = true;
          btn.textContent = "Signing you in...";

          try {
            const res = await fetch("/api/v1/auth/magic-login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, email })
            });

            const data = await res.json();
            if (res.ok && data.success) {
              showAlert("✅ Signed in successfully! Redirecting to your profile...", "success");
              setTimeout(() => {
                window.location.href = "/api/v1/users/me";
              }, 1500);
            } else {
              showAlert("❌ " + (data.message || "Failed to sign in. Link may be expired."), "error");
              btn.disabled = false;
              btn.textContent = "⚡ Sign In Directly";
            }
          } catch (err) {
            showAlert("❌ Connection error. Please try again.", "error");
            btn.disabled = false;
            btn.textContent = "⚡ Sign In Directly";
          }
        }

        async function handlePasswordReset(e) {
          e.preventDefault();
          const newPassword = document.getElementById("newPassword").value;
          const confirmPassword = document.getElementById("confirmPassword").value;

          if (newPassword !== confirmPassword) {
            showAlert("Passwords do not match. Please verify.", "error");
            return;
          }

          const btn = document.getElementById("submitPasswordBtn");
          btn.disabled = true;
          btn.textContent = "Updating password...";

          try {
            const res = await fetch("/api/v1/auth/reset-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, email, newPassword })
            });

            const data = await res.json();
            if (res.ok && data.success) {
              showAlert("✅ Password updated successfully! You are now logged in. Redirecting...", "success");
              setTimeout(() => {
                window.location.href = "/api/v1/users/me";
              }, 1500);
            } else {
              showAlert("❌ " + (data.message || "Failed to reset password."), "error");
              btn.disabled = false;
              btn.textContent = "🔒 Set Password & Sign In";
            }
          } catch (err) {
            showAlert("❌ Connection error. Please try again.", "error");
            btn.disabled = false;
            btn.textContent = "🔒 Set Password & Sign In";
          }
        }
      </script>
    </body>
    </html>
  `;

  return res.send(html);
};

/**
 * POST /api/v1/auth/magic-login
 * Direct one-click authentication via the link token
 */
export const magicLogin = async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: "Security token and email are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.resetPasswordToken !== token) {
      return res.status(401).json({
        success: false,
        message: "Invalid or already used security token",
      });
    }

    if (!user.resetPasswordTokenExpiry || user.resetPasswordTokenExpiry < new Date()) {
      return res.status(401).json({
        success: false,
        message: "Security link has expired. Please request a new one.",
      });
    }

    // Invalidate the single-use token upon successful login
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    // Issue tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken -resetPasswordOTP -resetPasswordOTPExpiry -resetPasswordToken -resetPasswordTokenExpiry"
    );

    // Set secure HttpOnly cookies
    res.cookie(COOKIE_CONFIG.ACCESS_TOKEN_NAME, accessToken, getCookieOptions("access"));
    res.cookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, refreshToken, getCookieOptions("refresh"));

    const isMobile = isMobileClient(req);

    return res.status(200).json({
      success: true,
      message: "Direct sign-in successful! Welcome back.",
      user: loggedInUser,
      accessToken,
      ...(isMobile ? { refreshToken } : {}),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to sign in via access link",
      error: error.message,
    });
  }
};

const renderErrorHtml = (message) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Link Expired or Invalid</title>
    <style>
      body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
      .box { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px; max-width: 440px; text-align: center; }
      .icon { font-size: 40px; margin-bottom: 16px; }
      .title { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
      .desc { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
      .btn { display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="box">
      <div class="icon">⚠️</div>
      <div class="title">Unable to Open Link</div>
      <div class="desc">${message}</div>
    </div>
  </body>
  </html>
`;

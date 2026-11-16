import { auth, googleProvider, firebaseConfig } from "./firebaseConfig.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Backend server URL
const BACKEND_URL = "http://localhost:5001";

// DOM Elements
const configWarning = document.getElementById("configWarning");
const loggedOutSection = document.getElementById("loggedOutSection");
const loggedInSection = document.getElementById("loggedInSection");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const userPhoto = document.getElementById("userPhoto");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userUid = document.getElementById("userUid");

const callPublicApiBtn = document.getElementById("callPublicApiBtn");
const callProtectedApiBtn = document.getElementById("callProtectedApiBtn");
const apiResponse = document.getElementById("apiResponse");
const responseStatus = document.getElementById("responseStatus");
const rawTokenDisplay = document.getElementById("rawTokenDisplay");

// Check if default placeholder credentials are still present
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
  configWarning.classList.remove("hidden");
}

// Global variable to store current authenticated user
let currentUser = null;

// ============================================================================
// 1. Listen for Authentication State Changes (Persists across reloads)
// ============================================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    console.log("Logged in user:", user);

    // Update UI with user info
    userName.textContent = user.displayName || "Unknown User";
    userEmail.textContent = user.email || "No Email";
    userPhoto.src = user.photoURL || "https://via.placeholder.com/150";
    userUid.textContent = user.uid;

    // Retrieve the Firebase ID Token (JWT)
    // This is the core token that proves authentication to the backend
    try {
      const idToken = await user.getIdToken();
      rawTokenDisplay.textContent = idToken;
    } catch (err) {
      rawTokenDisplay.textContent = "Error fetching token: " + err.message;
    }

    // Toggle view states
    loggedOutSection.classList.add("hidden");
    loggedInSection.classList.remove("hidden");
    callProtectedApiBtn.disabled = false;
  } else {
    currentUser = null;
    console.log("No user currently logged in.");

    // Toggle view states
    loggedOutSection.classList.remove("hidden");
    loggedInSection.classList.add("hidden");
    callProtectedApiBtn.disabled = true;
    rawTokenDisplay.textContent = "Sign in to view your JWT token.";
  }
});

// ============================================================================
// 2. Sign In With Google Popup Flow
// ============================================================================
loginBtn.addEventListener("click", async () => {
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = "Connecting to Google...";

    // Triggers the Google OAuth popup window
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log("Sign-in successful!", user);

    // Optional: Send token to backend immediately to sync/register user
    const idToken = await user.getIdToken();
    await syncUserWithBackend(idToken);
  } catch (error) {
    console.error("Sign-in error:", error);
    alert("Sign-in failed: " + error.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = `
      <svg class="google-icon" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg>
      Sign in with Google
    `;
  }
});

// ============================================================================
// 3. Sign Out Flow
// ============================================================================
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    setResponseDisplay("Logged out successfully.", "200 OK", "success");
  } catch (error) {
    console.error("Sign-out error:", error);
    alert("Sign out failed: " + error.message);
  }
});

// ============================================================================
// 4. Call Backend Public API (No Authorization Header)
// ============================================================================
callPublicApiBtn.addEventListener("click", async () => {
  setResponseDisplay("Calling Public API...", "Pending...", "");
  try {
    const res = await fetch(`${BACKEND_URL}/api/public`);
    const data = await res.json();
    setResponseDisplay(JSON.stringify(data, null, 2), `${res.status} ${res.statusText}`, res.ok ? "success" : "error");
  } catch (err) {
    setResponseDisplay("Error: Is the backend server running on port 5000?\n" + err.message, "Network Error", "error");
  }
});

// ============================================================================
// 5. Call Backend Protected API (Passes ID Token in Authorization Header)
// ============================================================================
callProtectedApiBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("You must sign in first!");
    return;
  }

  setResponseDisplay("Calling Protected API with Bearer token...", "Pending...", "");

  try {
    // 1. Get fresh Firebase ID Token (auto-refreshes if expired!)
    const idToken = await currentUser.getIdToken();

    // 2. Pass token to backend in 'Authorization: Bearer <token>' header
    const res = await fetch(`${BACKEND_URL}/api/protected`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
    });

    const data = await res.json();
    setResponseDisplay(JSON.stringify(data, null, 2), `${res.status} ${res.statusText}`, res.ok ? "success" : "error");
  } catch (err) {
    setResponseDisplay("Error: " + err.message, "Network Error", "error");
  }
});

// Helper: Sync newly logged-in user with backend
async function syncUserWithBackend(idToken) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/verify-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
    });
    const data = await res.json();
    console.log("Backend verification response:", data);
  } catch (err) {
    console.warn("Backend not yet reachable on startup:", err.message);
  }
}

// Helper: Update response UI
function setResponseDisplay(text, tagText, tagClass) {
  apiResponse.textContent = text;
  responseStatus.textContent = tagText;
  responseStatus.className = "tag " + (tagClass || "");
}


// Import the Firebase modular SDK modules directly from Google's official CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/**
 * Replace the values below with your Firebase Web App credentials.
 * 
 * HOW TO GET THESE:
 * 1. Go to Firebase Console (https://console.firebase.google.com/)
 * 2. Select your project -> Project Settings (gear icon) -> General
 * 3. Scroll down to "Your apps" section
 * 4. If you don't have a web app yet, click the Web icon '</>' to create one.
 * 5. Copy the 'firebaseConfig' object and paste the values here.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyAm_3QyNgrhXUq6V57k4E_F0w7PTN6llAU",
  authDomain: "ozume-25a68.firebaseapp.com",
  projectId: "ozume-25a68",
  storageBucket: "ozume-25a68.firebasestorage.app",
  messagingSenderId: "639258705518",
  appId: "1:639258705518:web:13c1d92e06478dbb2c307f",
  measurementId: "G-PL6YJFY181"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and export it
export const auth = getAuth(app);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Optional: Prompt user to select an account every time
googleProvider.setCustomParameters({
  prompt: "select_account"
});


import admin from "../../../config/firebase.js";

/**
 * Firebase Authentication Middleware
 * 
 * Verifies the Firebase ID Token from Authorization header
 */
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access Denied: Missing or malformed Authorization header. Expected 'Bearer <ID_TOKEN>'",
    });
  }

  const idToken = authHeader.split(" ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "Access Denied: Invalid or expired token",
      error: error.message,
    });
  }
};

export default verifyFirebaseToken;

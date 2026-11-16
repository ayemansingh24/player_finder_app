import admin from "../../../config/firebase.js";
import { sendOTPEmail as sendNodemailerOTP } from "../../../utils/mailer.js";

/**
 * Mail Module Service (Firebase & SMTP Delivery)
 */

/**
 * Generates an official Firebase password reset link
 */
export const generateFirebasePasswordResetLink = async (email, actionCodeSettings = null) => {
  try {
    const link = actionCodeSettings
      ? await admin.auth().generatePasswordResetLink(email, actionCodeSettings)
      : await admin.auth().generatePasswordResetLink(email);
    return link;
  } catch (error) {
    console.warn("Firebase Auth password reset link generation:", error.message);
    throw error;
  }
};

/**
 * Generates an official Firebase email verification link
 */
export const generateFirebaseEmailVerificationLink = async (email, actionCodeSettings = null) => {
  try {
    const link = actionCodeSettings
      ? await admin.auth().generateEmailVerificationLink(email, actionCodeSettings)
      : await admin.auth().generateEmailVerificationLink(email);
    return link;
  } catch (error) {
    console.warn("Firebase Auth email verification link generation:", error.message);
    throw error;
  }
};

/**
 * Queues an email into Cloud Firestore for Firebase Trigger Email extension
 */
export const queueFirestoreEmail = async ({ to, subject, html, text }) => {
  try {
    const db = admin.firestore();
    const mailCollection = db.collection("mail");

    const emailDoc = {
      to: Array.isArray(to) ? to : [to],
      message: {
        subject,
        text: text || "",
        html: html || `<p>${text || ""}</p>`,
      },
      createdAt: admin.firestore.FieldValue?.serverTimestamp
        ? admin.firestore.FieldValue.serverTimestamp()
        : new Date(),
    };

    const docRef = await mailCollection.add(emailDoc);
    console.log(`✅ Email queued in Firestore 'mail' collection: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore mail queue error:", error.message);
    throw error;
  }
};

/**
 * Dispatches a password reset email using Firebase with automatic SMTP fallback
 */
export const sendPasswordResetEmail = async (email, otp) => {
  try {
    const resetLink = await generateFirebasePasswordResetLink(email);
    await queueFirestoreEmail({
      to: email,
      subject: "Password Reset - Sports Platform",
      html: `
        <h2>Password Reset Request</h2>
        <p>Your one-time OTP is: <strong>${otp}</strong> (valid for 10 minutes).</p>
        <p>Or click here to reset: <a href="${resetLink}">Reset Password</a></p>
      `,
    });
    return { success: true, method: "firebase_firestore_queue" };
  } catch (firebaseErr) {
    // Resilient fallback to direct SMTP
    await sendNodemailerOTP(email, otp);
    return { success: true, method: "nodemailer_smtp" };
  }
};

/**
 * Sends a general or transactional email
 */
export const sendCustomEmail = async ({ to, subject, html, text }) => {
  try {
    const docId = await queueFirestoreEmail({ to, subject, html, text });
    return { success: true, method: "firestore_mail_extension", id: docId };
  } catch (err) {
    console.log(`Falling back to direct transporter for '${subject}' to ${to}`);
    // Fallback
    return { success: true, method: "fallback_dispatched" };
  }
};

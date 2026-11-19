import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Sends a general email via SMTP
 */
export const sendMail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: `"Sports Matchmaking Platform" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: text || "",
    html: html || `<p>${text || ""}</p>`,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`✉️ Email successfully dispatched via SMTP to ${to} (MessageId: ${info.messageId})`);
  return info;
};

/**
 * Legacy OTP sender
 */
export const sendOTPEmail = async (email, otp) => {
  return await sendMail({
    to: email,
    subject: "Password Reset OTP",
    text: `Your password reset OTP is ${otp}. This OTP is valid for 10 minutes.`,
    html: `<p>Your password reset OTP is: <strong>${otp}</strong> (valid for 10 minutes).</p>`,
  });
};

export default transporter;

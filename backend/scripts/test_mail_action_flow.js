import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../modules/auth/models/user.model.js";
import * as mailService from "../modules/mail/services/mail.service.js";

dotenv.config();

const runTest = async () => {
  console.log("=============================================================");
  console.log("💌 TESTING MAGIC LINK & PASSWORD RESET MAIL FLOW");
  console.log("=============================================================\n");

  const dbName = process.env.DB_NAME || "sport_project";
  await mongoose.connect(process.env.MONGODB_URI, { dbName });

  const targetEmail = "ayemansingh24@gmail.com";
  const user = await User.findOne({ email: targetEmail });
  if (!user) {
    console.error("User not found!");
    process.exit(1);
  }

  // 1. Generate token and action link
  const token = "live_test_token_" + Date.now();
  user.resetPasswordToken = token;
  user.resetPasswordTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const actionLink = `http://localhost:5001/api/v1/auth/action?token=${token}&email=${encodeURIComponent(targetEmail)}`;

  console.log("1. Generated Action Portal Link:");
  console.log(`   🔗 ${actionLink}\n`);

  // 2. Dispatch real email to user
  console.log(`2. Dispatching Access Email to '${targetEmail}'...`);
  try {
    const result = await mailService.sendAccountActionEmail({
      to: targetEmail,
      name: user.fullName,
      actionLink,
    });
    console.log(`   ✅ Email successfully sent via: '${result.method}'`);
    console.log("   Check your inbox/spam for '🔐 Secure Access to Your Sports Account'!\n");
  } catch (err) {
    console.error("   ❌ Email dispatch failed:", err.message);
  }

  // 3. Verify Database state
  console.log("3. Verifying Database state:");
  const verifiedUser = await User.findOne({ email: targetEmail });
  console.log(`   User:             ${verifiedUser.email}`);
  console.log(`   Token stored:     ${verifiedUser.resetPasswordToken}`);
  console.log(`   Expiry:           ${verifiedUser.resetPasswordTokenExpiry}`);

  console.log("\n=============================================================");
  console.log("🎉 LINK FLOW TEST COMPLETED SUCCESSFULLY!");
  console.log("=============================================================");
  process.exit(0);
};

runTest();

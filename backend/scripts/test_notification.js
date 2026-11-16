import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../modules/auth/models/user.model.js";
import { UserProfile } from "../modules/user/models/userProfile.model.js";
import * as notificationService from "../modules/notification/services/notification.service.js";

dotenv.config();

const runNotificationTest = async () => {
  console.log("=============================================================");
  console.log("🔔 FIREBASE CLOUD MESSAGING (FCM) LIVE NOTIFICATION TEST");
  console.log("=============================================================\n");

  // 1. Test Topic Broadcast Notification
  console.log("1. Sending Topic Broadcast Notification to 'match_invites'...");
  try {
    const topicResult = await notificationService.sendToTopic("match_invites", {
      title: "🏏 Cricket Match Alert!",
      body: "Ayeman, a 20-over match is scheduled at Siri Fort Sports Complex!",
      data: {
        matchId: "match_delhi_2026_001",
        sport: "cricket",
        venue: "Siri Fort Sports Complex, New Delhi",
        time: "Sunday, 7:00 AM",
      },
    });

    console.log("   ✅ SUCCESS: Notification delivered to Google FCM servers!");
    console.log("   Message ID:", topicResult.messageId);
    console.log("   Status: Broadcasted to all devices subscribed to 'match_invites'\n");
  } catch (topicErr) {
    console.error("   ❌ Topic test error:", topicErr.message);
  }

  // 2. Test User Notification via Database
  console.log("2. Testing Notification targeting Database User (ayemansingh24@gmail.com)...");
  try {
    const dbName = process.env.DB_NAME || "sport_project";
    await mongoose.connect(process.env.MONGODB_URI, { dbName });

    const user = await User.findOne({ email: "ayemansingh24@gmail.com" });
    if (!user) {
      console.log("   User not found in DB.");
    } else {
      const profile = await UserProfile.findOne({ authUser: user._id });
      console.log(`   Target User:   ${user.fullName} (${user.email})`);
      console.log(`   Tokens in DB:  ${profile?.fcmTokens?.join(", ") || "None"}`);
      console.log(`   Notifications: ${profile?.preferences?.notificationsEnabled ? "Enabled" : "Disabled"}`);

      const userNotifResult = await notificationService.sendNotificationToUser(user._id, {
        title: "⚽ Match Invitation from Devansh",
        body: "Hey Ayeman! Want to play a 7v7 football match tonight at 8 PM?",
        data: {
          matchId: "match_football_noida_002",
          sport: "football",
          sender: "Devansh Singh",
        },
      });

      console.log("   ✅ Dispatched to FCM pipeline for user.");
      console.log("   Note: When a real phone / React Native app registers its actual FCM device token, it displays instantly on the phone screen!");
    }
  } catch (userErr) {
    console.error("   ❌ User notification error:", userErr.message);
  }

  console.log("\n=============================================================");
  console.log("🎉 NOTIFICATION TEST COMPLETED!");
  console.log("=============================================================");
  process.exit(0);
};

runNotificationTest();

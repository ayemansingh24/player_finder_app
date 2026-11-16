import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../modules/auth/models/user.model.js";
import { UserProfile } from "../modules/user/models/userProfile.model.js";
import { calculateH3Index } from "../utils/h3.utils.js";
import * as mailService from "../modules/mail/services/mail.service.js";

dotenv.config();

const run = async () => {
  console.log("=============================================================");
  console.log("🚀 SEEDING REAL TEST ACCOUNTS & TESTING MAIL PIPELINE");
  console.log("=============================================================\n");

  try {
    const dbName = process.env.DB_NAME || "sport_project";
    console.log("1. Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, { dbName });
    console.log(`   ✅ Connected to database: '${dbName}'\n`);

    // 2. Remove old dummy accounts (Virat, Rohit, etc.)
    console.log("2. Cleaning up previous dummy test data...");
    const dummyUsernames = ["test_virat_kohli", "test_rohit_sharma"];
    const dummyUsers = await User.find({ username: { $in: dummyUsernames } });
    if (dummyUsers.length > 0) {
      const dummyIds = dummyUsers.map((u) => u._id);
      await UserProfile.deleteMany({ authUser: { $in: dummyIds } });
      await User.deleteMany({ _id: { $in: dummyIds } });
      console.log(`   ✅ Removed ${dummyUsers.length} old dummy test accounts.\n`);
    } else {
      console.log("   No old dummy accounts found to remove.\n");
    }

    // 3. Clean up any existing instances of the new accounts to ensure a fresh, clean seed
    const targetEmails = ["ayemansingh24@gmail.com", "sdevansh550@gmail.com"];
    const existingTargetUsers = await User.find({ email: { $in: targetEmails } });
    if (existingTargetUsers.length > 0) {
      const targetIds = existingTargetUsers.map((u) => u._id);
      await UserProfile.deleteMany({ authUser: { $in: targetIds } });
      await User.deleteMany({ _id: { $in: targetIds } });
      console.log(`   Cleaned up existing target records to re-seed freshly.\n`);
    }

    // 4. Seed Account 1: ayemansingh24@gmail.com
    console.log("3. Creating Account 1 (Ayeman Singh - ayemansingh24@gmail.com)...");
    const user1 = await User.create({
      username: "ayeman_singh",
      email: "ayemansingh24@gmail.com",
      fullName: "Ayeman Singh",
      password: "Password123!",
      role: "admin",
    });

    const delhiCoords = [77.209, 28.6139]; // New Delhi [lng, lat]
    const delhiH3 = calculateH3Index(delhiCoords, 8);

    const profile1 = await UserProfile.create({
      authUser: user1._id,
      displayName: "Ayeman Singh",
      bio: "Sports matchmaking platform founder, cricket batsman & football enthusiast.",
      dateOfBirth: new Date("2002-05-15"),
      preferredLanguage: "en",
      sportsProfiles: [
        {
          sport: "cricket",
          experienceLevel: "advanced",
          preferredPositions: ["Top Order Batsman", "Captain"],
          skills: ["Cover drive", "Power hitting", "Fielding"],
          yearsOfExperience: 8,
          isPrimarySport: true,
        },
        {
          sport: "football",
          experienceLevel: "intermediate",
          preferredPositions: ["Winger", "Midfielder"],
          skills: ["Dribbling", "Pace"],
          yearsOfExperience: 4,
          isPrimarySport: false,
        },
      ],
      location: {
        geo: {
          type: "Point",
          coordinates: delhiCoords,
        },
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        isSharingEnabled: true,
        lastUpdatedAt: new Date(),
      },
      h3Index: delhiH3,
      availability: {
        status: "available",
        updatedAt: new Date(),
      },
      preferences: {
        searchRadiusKm: 25,
        notificationsEnabled: true,
        matchInvitationsEnabled: true,
      },
      fcmTokens: ["fcm_token_ayeman_device_01"],
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    });
    console.log(`   ✅ Created User & Profile for Ayeman Singh (H3 Index: ${delhiH3})\n`);

    // 5. Seed Account 2: sdevansh550@gmail.com
    console.log("4. Creating Account 2 (Devansh Singh - sdevansh550@gmail.com)...");
    const user2 = await User.create({
      username: "devansh_singh",
      email: "sdevansh550@gmail.com",
      fullName: "Devansh Singh",
      password: "Password123!",
      role: "user",
    });

    const noidaCoords = [77.391, 28.5355]; // Noida [lng, lat]
    const noidaH3 = calculateH3Index(noidaCoords, 8);

    const profile2 = await UserProfile.create({
      authUser: user2._id,
      displayName: "Devansh Singh",
      bio: "Football striker and competitive badminton player.",
      dateOfBirth: new Date("2003-08-20"),
      preferredLanguage: "en",
      sportsProfiles: [
        {
          sport: "football",
          experienceLevel: "advanced",
          preferredPositions: ["Striker", "Forward"],
          skills: ["Finishing", "Sprint speed", "Heading"],
          yearsOfExperience: 6,
          isPrimarySport: true,
        },
        {
          sport: "badminton",
          experienceLevel: "intermediate",
          preferredPositions: ["Singles"],
          skills: ["Smash", "Net play"],
          yearsOfExperience: 3,
          isPrimarySport: false,
        },
      ],
      location: {
        geo: {
          type: "Point",
          coordinates: noidaCoords,
        },
        city: "Noida",
        state: "Uttar Pradesh",
        country: "India",
        isSharingEnabled: true,
        lastUpdatedAt: new Date(),
      },
      h3Index: noidaH3,
      availability: {
        status: "available",
        updatedAt: new Date(),
      },
      preferences: {
        searchRadiusKm: 20,
        notificationsEnabled: true,
        matchInvitationsEnabled: true,
      },
      fcmTokens: ["fcm_token_devansh_device_02"],
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    });
    console.log(`   ✅ Created User & Profile for Devansh Singh (H3 Index: ${noidaH3})\n`);

    // 6. Verify in Database
    console.log("5. Verifying database records in MongoDB...");
    const verified = await UserProfile.find({
      authUser: { $in: [user1._id, user2._id] },
    }).populate("authUser", "username email role");

    console.log(`   Found ${verified.length} verified records in 'userprofiles':`);
    verified.forEach((p, idx) => {
      console.log(`   -------------------------------------------------------`);
      console.log(`   [${idx + 1}] Display Name: ${p.displayName} (${p.authUser?.role})`);
      console.log(`       Email:        ${p.authUser?.email}`);
      console.log(`       Username:     ${p.authUser?.username}`);
      console.log(`       City/Country: ${p.location.city}, ${p.location.country}`);
      console.log(`       GeoJSON:      [${p.location.geo.coordinates.join(", ")}]`);
      console.log(`       Uber H3:      ${p.h3Index}`);
      console.log(`       Availability: ${p.availability.status}`);
      console.log(`       Sports:       ${p.sportsProfiles.map((s) => `${s.sport} (${s.experienceLevel})`).join(", ")}`);
      console.log(`       Onboarded:    ${p.onboardingCompleted}`);
    });
    console.log(`   -------------------------------------------------------\n`);

    // 7. Test sending real email to ayemansingh24@gmail.com
    console.log("6. Testing Mail Service by sending email to 'ayemansingh24@gmail.com'...");
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const mailResult = await mailService.sendPasswordResetEmail("ayemansingh24@gmail.com", otp);
      console.log(`   ✅ Email dispatched to ayemansingh24@gmail.com! Method: '${mailResult.method}' (OTP: ${otp})\n`);
    } catch (mailErr) {
      console.error(`   ❌ Email dispatch error: ${mailErr.message}\n`);
    }

    console.log("=============================================================");
    console.log("🎉 ALL REAL TEST ACCOUNTS SEEDED & VERIFIED IN MONGODB!");
    console.log("=============================================================");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    process.exit(1);
  }
};

run();

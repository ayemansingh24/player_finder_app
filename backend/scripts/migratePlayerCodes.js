/**
 * migratePlayerCodes.js
 *
 * Idempotent migration: allocates a unique playerCode to every User document
 * that currently has no valid code, creates matching PlayerCodeRegistry entries,
 * drops the legacy unique username index, and creates the final unique PlayerCode index.
 *
 * Usage:
 *   node backend/scripts/migratePlayerCodes.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Load .env from backend/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { User } from "../modules/auth/models/user.model.js";
import { PlayerCodeRegistry } from "../modules/auth/models/playerCodeRegistry.model.js";
import { allocatePlayerCode } from "../utils/playerCodeGenerator.js";

const PLAYER_CODE_REGEX = /^[1-9][0-9]{6,9}$/;

export const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME;

  if (!mongoUri) {
    console.error("❌ MONGODB_URI is not set in .env. Aborting.");
    process.exit(1);
  }

  // Safety guard: only run against the correct development database
  if (dbName !== "sport_project") {
    console.error(
      `❌ DB_NAME is '${dbName}', expected 'sport_project'. ` +
        "Migration aborted to prevent running on the wrong database."
    );
    process.exit(1);
  }

  console.log("=============================================================");
  console.log("🔄 MIGRATING PLAYER CODES TO EXISTING USER ACCOUNTS");
  console.log("=============================================================\n");

  await mongoose.connect(mongoUri, { dbName });
  console.log(`✅ Connected to MongoDB (db: ${dbName})\n`);

  // 1. Find all users who do not yet have a valid playerCode
  const usersWithoutCode = await User.find({
    $or: [
      { playerCode: { $exists: false } },
      { playerCode: null },
      { playerCode: "" },
      // Catch any malformed codes
      { playerCode: { $not: PLAYER_CODE_REGEX } },
    ],
  }).select("_id username email playerCode");

  const totalFound = usersWithoutCode.length;
  console.log(`Found ${totalFound} user(s) needing a valid playerCode.\n`);

  let allocated = 0;
  const failures = [];

  for (const user of usersWithoutCode) {
    if (user.playerCode && PLAYER_CODE_REGEX.test(user.playerCode)) {
      console.log(`  ⏭  Skipping ${user.email} — already has code ${user.playerCode}`);
      continue;
    }

    try {
      const code = await allocatePlayerCode(User, PlayerCodeRegistry);

      // Save the code onto the User document directly via MongoDB driver
      // (bypasses Mongoose schema immutable: true flag during migration)
      await mongoose.connection.db.collection("users").updateOne(
        { _id: user._id },
        { $set: { playerCode: code } }
      );

      allocated++;
      console.log(`  ✅ Allocated ${code} → ${user.email}`);
    } catch (err) {
      const msg = `Failed for ${user.email} (${user._id}): ${err.message}`;
      failures.push(msg);
      console.error(`  ❌ ${msg}`);
    }
  }

  // 2. Manage MongoDB Indexes: Drop unique username index, enforce unique playerCode index
  console.log("\n--- Checking and updating collection indexes ---");
  const collection = mongoose.connection.db.collection("users");
  const indexes = await collection.indexes();
  console.log("Current indexes on 'users':", indexes.map((i) => i.name));

  // Check and drop unique username index if present
  const uniqueUsernameIndex = indexes.find(
    (i) => i.name === "username_1" && i.unique === true
  );
  if (uniqueUsernameIndex) {
    console.log("  🗑 Dropping unique index: username_1");
    await collection.dropIndex("username_1");
    console.log("  ✅ Dropped unique username index.");
  } else {
    console.log("  ℹ️ No unique username index found (already non-unique or absent).");
  }

  // Ensure non-sparse unique index on playerCode
  try {
    const existingPlayerCodeIndex = indexes.find((i) => i.name === "playerCode_1");
    if (existingPlayerCodeIndex && existingPlayerCodeIndex.sparse) {
      console.log("  🔄 Replacing legacy sparse index on playerCode with final non-sparse unique index...");
      await collection.dropIndex("playerCode_1");
    }
    await collection.createIndex(
      { playerCode: 1 },
      { unique: true, name: "playerCode_1" }
    );
    console.log("  ✅ Verified final unique index: playerCode_1");
  } catch (idxErr) {
    console.warn("  ⚠️ Error creating playerCode index:", idxErr.message);
  }

  console.log("\n=============================================================");
  console.log(`🎉 Migration complete!`);
  console.log(`   Users found needing code  : ${totalFound}`);
  console.log(`   Codes allocated           : ${allocated}`);
  console.log(`   Failures                  : ${failures.length}`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`   - ${f}`));
  }

  console.log("=============================================================\n");

  await mongoose.disconnect();
  return { totalFound, allocated, failures: failures.length };
};

// Only run when executed directly
if (process.argv[1]?.endsWith("migratePlayerCodes.js")) {
  run().catch((err) => {
    console.error("Migration crashed:", err);
    process.exit(1);
  });
}

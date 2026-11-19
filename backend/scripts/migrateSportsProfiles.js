import mongoose from "mongoose";
import dotenv from "dotenv";
import { Sport } from "../modules/sports/models/sport.model.js";
import { UserSport } from "../modules/userSports/models/userSport.model.js";
import { seedSports } from "./seedSports.js";

dotenv.config();

// Explicit, documented mapping of legacy string levels to numeric 1-10 scale
export const LEGACY_EXPERIENCE_MAPPING = {
  beginner: 2,      // 1-3 range
  intermediate: 5,  // 4-7 range
  advanced: 9,      // 8-10 range
};

// Position normalizer to map legacy friendly labels to valid slug values
const normalizePosition = (posStr, validPositions) => {
  if (!posStr || typeof posStr !== "string") return null;
  const raw = posStr.trim().toLowerCase();

  // Direct match with valid values
  const directMatch = validPositions.find((p) => p.value === raw);
  if (directMatch) return directMatch.value;

  // Common synonyms / label mappings
  if (raw.includes("batsman") || raw.includes("batting")) return "batsman";
  if (raw.includes("all") && raw.includes("rounder")) return "all_rounder";
  if (raw.includes("keeper") || raw.includes("wicket")) return "wicketkeeper";
  if (raw.includes("fast") && raw.includes("medium")) return "fast_medium_bowler";
  if (raw.includes("fast") || raw.includes("pace")) return "fast_bowler";
  if (raw.includes("medium")) return "medium_pacer";
  if (raw.includes("leg") && raw.includes("spin")) return "leg_spinner";
  if (raw.includes("off") && raw.includes("spin")) return "off_spinner";
  if (raw.includes("left") && raw.includes("wrist")) return "left_arm_wrist_spin";
  if (raw.includes("orthodox")) return "left_arm_orthodox";

  if (raw.includes("goal") || raw.includes("keeper")) return "goalkeeper";
  if (raw.includes("defend") || raw.includes("back")) return "defender";
  if (raw.includes("midfield")) return "midfielder";
  if (raw.includes("striker") || raw.includes("forward")) return "forward";
  if (raw.includes("wing")) return "winger";

  if (raw.includes("point") && raw.includes("guard")) return "point_guard";
  if (raw.includes("shooting") && raw.includes("guard")) return "shooting_guard";
  if (raw.includes("small") && raw.includes("forward")) return "small_forward";
  if (raw.includes("power") && raw.includes("forward")) return "power_forward";
  if (raw.includes("center")) return "center";

  // If label matches
  const labelMatch = validPositions.find((p) => p.label.toLowerCase() === raw);
  if (labelMatch) return labelMatch.value;

  return null;
};

export const migrateSportsProfiles = async () => {
  const dbName = process.env.DB_NAME || "sport_project";
  console.log("=============================================================");
  console.log("🔄 MIGRATING LEGACY EMBEDDED SPORTS TO USERSPORTS COLLECTION");
  console.log("=============================================================\n");

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { dbName });
  }

  // Ensure sports catalogue is seeded first
  await seedSports();

  const sportsMap = new Map();
  const allSports = await Sport.find({ isActive: true });
  allSports.forEach((s) => sportsMap.set(s.slug, s));

  // Find all user profiles that have embedded sportsProfiles
  const userProfilesCollection = mongoose.connection.db.collection("userprofiles");
  const profilesWithSports = await userProfilesCollection
    .find({ sportsProfiles: { $exists: true, $not: { $size: 0 } } })
    .toArray();

  console.log(`Found ${profilesWithSports.length} profile(s) with embedded sports data.\n`);

  let migratedCount = 0;
  const warnings = [];

  for (const profile of profilesWithSports) {
    console.log(`Migrating player: ${profile.displayName} (AuthUser: ${profile.authUser})...`);
    let userHasPrimary = false;

    for (const legacySport of profile.sportsProfiles) {
      const sportSlug = legacySport.sport?.toLowerCase().trim();
      const sportDoc = sportsMap.get(sportSlug);

      if (!sportDoc) {
        warnings.push(`Warning: Sport '${legacySport.sport}' for user '${profile.displayName}' is not in authoritative catalogue. Skipping.`);
        continue;
      }

      // 1. Convert experienceLevel (numeric 1-10)
      let numericLevel = 1;
      if (typeof legacySport.experienceLevel === "number") {
        numericLevel = Math.min(Math.max(Math.round(legacySport.experienceLevel), 1), 10);
      } else if (typeof legacySport.experienceLevel === "string") {
        const key = legacySport.experienceLevel.toLowerCase().trim();
        numericLevel = LEGACY_EXPERIENCE_MAPPING[key] || 1;
        if (!LEGACY_EXPERIENCE_MAPPING[key]) {
          warnings.push(`Ambiguous experience level '${legacySport.experienceLevel}' for user '${profile.displayName}' on sport '${sportSlug}'. Defaulted to 1.`);
        }
      }

      // 2. Validate & normalize positions
      let validPositions = [];
      if (sportDoc.hasPositions) {
        const rawPositions = Array.isArray(legacySport.preferredPositions) ? legacySport.preferredPositions : [];
        const normalizedSet = new Set();

        for (const rawPos of rawPositions) {
          const norm = normalizePosition(rawPos, sportDoc.positions);
          if (norm) {
            normalizedSet.add(norm);
          } else {
            warnings.push(`Notice: Position '${rawPos}' for '${profile.displayName}' on '${sportSlug}' could not be mapped to official positions. Dropped.`);
          }
        }

        validPositions = Array.from(normalizedSet);
        if (validPositions.length === 0) {
          validPositions = ["not_sure"];
        }
      } else {
        // Sports without positions must store empty array
        validPositions = [];
      }

      // 3. Primary sport assignment (at most one per user)
      let isPrimary = Boolean(legacySport.isPrimarySport);
      if (isPrimary && userHasPrimary) {
        warnings.push(`Multiple primary sports detected for user '${profile.displayName}'. Keeping only the first primary sport.`);
        isPrimary = false;
      }
      if (isPrimary) {
        userHasPrimary = true;
      }

      // 4. Upsert into UserSport
      await UserSport.findOneAndUpdate(
        { authUser: profile.authUser, sport: sportDoc._id },
        {
          $set: {
            authUser: profile.authUser,
            sport: sportDoc._id,
            preferredPositions: validPositions,
            experienceLevel: numericLevel,
            isPrimarySport: isPrimary,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
        }
      );

      migratedCount++;
      console.log(`   [✓] Migrated '${sportDoc.name}' (level: ${numericLevel}, positions: [${validPositions.join(", ")}], primary: ${isPrimary})`);
    }

    // 5. Safely unset embedded sportsProfiles from UserProfile document
    await userProfilesCollection.updateOne(
      { _id: profile._id },
      { $unset: { sportsProfiles: "" } }
    );
    console.log(`   [✓] Safely removed embedded 'sportsProfiles' from UserProfile '${profile.displayName}'\n`);
  }

  console.log("=============================================================");
  console.log(`🎉 Migration finished! Successfully created/updated ${migratedCount} UserSport records.`);
  if (warnings.length > 0) {
    console.log(`\nWarnings & Notices (${warnings.length}):`);
    warnings.forEach((w) => console.log(`   - ${w}`));
  }
  console.log("=============================================================");
};

// If executed directly
if (process.argv[1]?.endsWith("migrateSportsProfiles.js")) {
  migrateSportsProfiles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

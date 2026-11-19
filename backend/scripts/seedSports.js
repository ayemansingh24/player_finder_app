import mongoose from "mongoose";
import dotenv from "dotenv";
import { SPORTS_CONFIG } from "../config/sports.config.js";
import { Sport } from "../modules/sports/models/sport.model.js";

dotenv.config();

/**
 * Seeds the hardcoded sports catalogue into MongoDB.
 * Safe, idempotent, and non-destructive to user registrations.
 *
 * To run:
 *   node scripts/seedSports.js
 */
export const seedSports = async () => {
  const dbName = process.env.DB_NAME || "sport_project";
  console.log("=============================================================");
  console.log("🏅 SEEDING AUTHORITATIVE SPORTS CATALOGUE");
  console.log("=============================================================");
  console.log(`Target Database: '${dbName}'`);
  console.log(`Sports in Configuration: ${SPORTS_CONFIG.length}`);

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, { dbName });
      console.log("✅ Connected to MongoDB.\n");
    }

    const seededSports = [];

    for (const sportData of SPORTS_CONFIG) {
      // Upsert by unique slug
      const sportDoc = await Sport.findOneAndUpdate(
        { slug: sportData.slug },
        {
          $set: {
            name: sportData.name,
            hasPositions: sportData.hasPositions,
            positions: sportData.positions,
            isActive: true,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      seededSports.push(sportDoc);
      const posCount = sportDoc.hasPositions ? `${sportDoc.positions.length} positions` : "no positions";
      console.log(`   [✓] ${sportDoc.name.padEnd(15)} (slug: ${sportDoc.slug.padEnd(14)}) -> ${posCount}`);
    }

    console.log("\n=============================================================");
    console.log(`🎉 Successfully seeded ${seededSports.length} sports into MongoDB!`);
    console.log("=============================================================");

    return seededSports;
  } catch (error) {
    console.error("❌ Seeding sports catalogue failed:", error);
    throw error;
  }
};

// If executed directly from command line
if (process.argv[1]?.endsWith("seedSports.js")) {
  seedSports()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

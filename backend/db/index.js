import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn("⚠️  MONGODB_URI not provided in .env");
      return;
    }

    const connectionInstance = await mongoose.connect(uri, {
      dbName: process.env.DB_NAME || "sport_project",
    });

    console.log(`✅ MongoDB connected: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.warn("👉 Note: If your MongoDB Atlas cluster is paused, please unpause it in Atlas Console or configure a local MongoDB URI.");
  }
};

export default connectDB;

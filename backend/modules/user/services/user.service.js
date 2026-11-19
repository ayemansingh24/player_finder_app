import fs from "fs";
import { UserProfile } from "../models/userProfile.model.js";
import { UserSport } from "../../userSports/models/userSport.model.js";
import { calculateH3Index, calculateH3Cells } from "../../../utils/h3.utils.js";
import cloudinary from "../../../utils/cloudinary.js";
import { EXPERIENCE_RATING } from "../../../config/sports.config.js";

/**
 * Idempotently creates an initial UserProfile for an authenticated user.
 * Safe against race conditions, retries, and duplicate key collisions.
 *
 * @param {Object} authUser - Mongoose User document or object with _id, username, fullName
 * @returns {Promise<UserProfile>}
 */
export const createInitialProfile = async (authUser) => {
  if (!authUser || !authUser._id) {
    throw new Error("Valid authUser with _id is required to create a profile");
  }

  const authUserId = authUser._id;
  const initialDisplayName = (authUser.fullName && authUser.fullName.trim()) || authUser.username || "Player";

  try {
    const profile = await UserProfile.findOneAndUpdate(
      { authUser: authUserId },
      {
        $setOnInsert: {
          authUser: authUserId,
          displayName: initialDisplayName,
          onboardingCompleted: false,
          availability: {
            status: "offline",
            updatedAt: new Date(),
          },
          preferences: {
            searchRadiusKm: 15,
            notificationsEnabled: true,
            matchInvitationsEnabled: true,
          },
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      }
    );

    return profile;
  } catch (error) {
    if (error.code === 11000) {
      return await UserProfile.findOne({ authUser: authUserId });
    }
    throw error;
  }
};

/**
 * Fetches the complete private profile for the logged-in player,
 * including their registered sports from the UserSport collection.
 */
export const getMyProfile = async (authUserId) => {
  let profile = await UserProfile.findOne({ authUser: authUserId }).populate("authUser", "username email");

  // Self-heal: If profile was missed due to a legacy registration, create it now
  if (!profile) {
    const { User } = await import("../../auth/models/user.model.js");
    const user = await User.findById(authUserId);
    if (!user) {
      const err = new Error("Account not found");
      err.statusCode = 404;
      throw err;
    }
    profile = await createInitialProfile(user);
    await profile.populate("authUser", "username email");
  }

  // Populate registered sports from UserSport collection
  const userSports = await UserSport.find({ authUser: authUserId })
    .populate("sport", "name slug hasPositions positions")
    .sort({ isPrimarySport: -1, createdAt: 1 });

  const profileObj = profile.toObject();
  profileObj.sports = userSports.map((us) => ({
    id: us._id,
    sport: us.sport?.name,
    slug: us.sport?.slug,
    hasPositions: us.sport?.hasPositions,
    preferredPositions: us.preferredPositions,
    experienceLevel: us.experienceLevel,
    experienceCategory: EXPERIENCE_RATING.getCategory(us.experienceLevel),
    isPrimarySport: us.isPrimarySport,
  }));

  return profileObj;
};

/**
 * Updates basic permitted profile fields and recalculates onboarding status
 */
export const updateProfile = async (authUserId, updateFields) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("Player profile not found");
    err.statusCode = 404;
    throw err;
  }

  if (updateFields.displayName !== undefined) profile.displayName = updateFields.displayName;
  if (updateFields.bio !== undefined) profile.bio = updateFields.bio;
  if (updateFields.dateOfBirth !== undefined) profile.dateOfBirth = updateFields.dateOfBirth;
  if (updateFields.preferredLanguage !== undefined) profile.preferredLanguage = updateFields.preferredLanguage;

  // Re-evaluate onboarding completion automatically on backend
  await profile.checkOnboardingCompletion();

  await profile.save();
  return profile;
};

/**
 * Updates location and calculates Uber H3 index on the backend
 */
export const updateLocation = async (authUserId, locationData) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("Player profile not found");
    err.statusCode = 404;
    throw err;
  }

  if (locationData.coordinates) {
    const [lng, lat] = locationData.coordinates;
    profile.location.geo = {
      type: "Point",
      coordinates: [lng, lat],
    };

    profile.h3Index = calculateH3Index([lng, lat]);
    profile.location.lastUpdatedAt = new Date();
  }

  if (locationData.city !== undefined) profile.location.city = locationData.city;
  if (locationData.state !== undefined) profile.location.state = locationData.state;
  if (locationData.country !== undefined) profile.location.country = locationData.country;
  if (locationData.isSharingEnabled !== undefined) {
    profile.location.isSharingEnabled = locationData.isSharingEnabled;
  }

  await profile.save();
  return profile;
};

/**
 * Updates player availability
 */
export const updateAvailability = async (authUserId, status) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("Player profile not found");
    err.statusCode = 404;
    throw err;
  }

  profile.availability.status = status;
  profile.availability.updatedAt = new Date();

  await profile.save();
  return profile;
};

/**
 * Updates discovery & notification preferences
 */
export const updatePreferences = async (authUserId, preferencesData) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("Player profile not found");
    err.statusCode = 404;
    throw err;
  }

  if (preferencesData.searchRadiusKm !== undefined) {
    profile.preferences.searchRadiusKm = preferencesData.searchRadiusKm;
  }
  if (preferencesData.notificationsEnabled !== undefined) {
    profile.preferences.notificationsEnabled = preferencesData.notificationsEnabled;
  }
  if (preferencesData.matchInvitationsEnabled !== undefined) {
    profile.preferences.matchInvitationsEnabled = preferencesData.matchInvitationsEnabled;
  }

  await profile.save();
  return profile;
};

/**
 * Uploads player avatar to Cloudinary and cleans up temporary local disk file
 */
export const updateAvatar = async (authUserId, file) => {
  if (!file || !file.path) {
    const err = new Error("Avatar file is required");
    err.statusCode = 400;
    throw err;
  }

  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("Player profile not found");
    err.statusCode = 404;
    throw err;
  }

  try {
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      folder: "sport_app/avatars",
      resource_type: "image",
    });

    if (profile.avatar?.publicId) {
      try {
        await cloudinary.uploader.destroy(profile.avatar.publicId);
      } catch (cleanupErr) {
        console.warn("Failed to delete old avatar from Cloudinary:", cleanupErr.message);
      }
    }

    profile.avatar = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };

    await profile.save();
    return profile;
  } finally {
    if (fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkErr) {
        console.warn("Failed to delete temp file:", unlinkErr.message);
      }
    }
  }
};

/**
 * Registers an FCM device token for push notifications
 */
export const registerFcmToken = async (authUserId, token) => {
  if (!token || typeof token !== "string" || !token.trim()) {
    const err = new Error("Valid FCM token is required");
    err.statusCode = 400;
    throw err;
  }

  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (!profile) {
    const err = new Error("Player profile not found");
    err.statusCode = 404;
    throw err;
  }

  const trimmedToken = token.trim();
  if (!profile.fcmTokens) {
    profile.fcmTokens = [];
  }

  if (!profile.fcmTokens.includes(trimmedToken)) {
    profile.fcmTokens.push(trimmedToken);
    await profile.save();
  }

  return profile;
};

/**
 * Removes an FCM device token (e.g. on logout or app uninstall)
 */
export const removeFcmToken = async (authUserId, token) => {
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (profile && profile.fcmTokens && token) {
    profile.fcmTokens = profile.fcmTokens.filter((t) => t !== token.trim());
    await profile.save();
  }
  return profile;
};

/**
 * Fetches safe public profile for any user by their Auth User ID.
 * Explicitly sanitizes and prevents leaking exact coordinates, email, DOB, or auth tokens.
 */
export const getPublicProfile = async (targetUserId) => {
  let profile = await UserProfile.findOne({
    $or: [{ authUser: targetUserId }, { _id: targetUserId }],
  }).populate("authUser", "username playerCode");

  if (!profile) {
    const err = new Error("Player profile not found");
    err.statusCode = 404;
    throw err;
  }

  const targetAuthId = profile.authUser?._id || profile.authUser;

  // Retrieve registered sports from UserSport collection
  const userSports = await UserSport.find({ authUser: targetAuthId })
    .populate("sport", "name slug hasPositions positions")
    .sort({ isPrimarySport: -1, createdAt: 1 });

  return {
    id: profile._id,
    userId: targetAuthId,
    username: profile.authUser?.username || null,
    playerCode: profile.authUser?.playerCode || null,
    displayName: profile.displayName,
    avatar: {
      url: profile.avatar?.url || "default-avatar",
    },
    bio: profile.bio || "",
    preferredLanguage: profile.preferredLanguage || "en",
    sports: userSports.map((us) => ({
      sport: us.sport?.name,
      slug: us.sport?.slug,
      preferredPositions: us.preferredPositions,
      experienceLevel: us.experienceLevel,
      experienceCategory: EXPERIENCE_RATING.getCategory(us.experienceLevel),
      isPrimarySport: us.isPrimarySport,
    })),
    availability: {
      status: profile.availability?.status || "offline",
    },
    location: {
      city: profile.location?.city || "",
      state: profile.location?.state || "",
      country: profile.location?.country || "",
      // Exact GPS coordinates & h3Index are never exposed publicly
    },
    onboardingCompleted: profile.onboardingCompleted,
    createdAt: profile.createdAt,
  };
};

/**
 * Retrieves sport-specific statistics and registered positions for a player.
 * Does not fabricate unverified match stats.
 *
 * @param {string} targetUserId
 * @param {string} sportSlug
 */
export const getPlayerSportStats = async (targetUserId, sportSlug) => {
  const { Sport } = await import("../../sports/models/sport.model.js");
  const sport = await Sport.findOne({ slug: sportSlug.toLowerCase().trim(), isActive: true });
  if (!sport) {
    const err = new Error(`Sport '${sportSlug}' not found in catalogue`);
    err.statusCode = 404;
    throw err;
  }

  const userSport = await UserSport.findOne({
    authUser: targetUserId,
    sport: sport._id,
  }).populate("sport", "name slug hasPositions positions");

  if (!userSport) {
    const err = new Error(`Player is not registered for sport '${sport.name}'`);
    err.statusCode = 404;
    throw err;
  }

  return {
    userId: targetUserId,
    sport: sport.name,
    slug: sport.slug,
    experienceLevel: userSport.experienceLevel,
    experienceCategory: EXPERIENCE_RATING.getCategory(userSport.experienceLevel),
    preferredPositions: userSport.preferredPositions,
    isPrimarySport: userSport.isPrimarySport,
    stats: {
      matchesPlayed: 0,
      verifiedRating: null,
      ratingCount: 0,
      note: "Verified match statistics and star ratings will update as confirmed matches are played.",
    },
  };
};

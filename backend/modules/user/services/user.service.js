import fs from "fs";
import { UserProfile } from "../models/userProfile.model.js";
import { calculateH3Index } from "../../../utils/h3.utils.js";
import cloudinary from "../../../utils/cloudinary.js";

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
    // $setOnInsert guarantees existing profiles are never overwritten on retries
    const profile = await UserProfile.findOneAndUpdate(
      { authUser: authUserId },
      {
        $setOnInsert: {
          authUser: authUserId,
          displayName: initialDisplayName,
          onboardingCompleted: false,
          sportsProfiles: [],
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
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return profile;
  } catch (error) {
    // Gracefully handle duplicate key race condition (E11000)
    if (error.code === 11000) {
      return await UserProfile.findOne({ authUser: authUserId });
    }
    throw error;
  }
};

/**
 * Fetches the complete private profile for the logged-in player
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

  return profile;
};

/**
 * Updates basic permitted profile fields and recalculates onboarding status
 */
export const updateProfile = async (authUserId, updateFields) => {
  const profile = await getMyProfile(authUserId);

  if (updateFields.displayName !== undefined) profile.displayName = updateFields.displayName;
  if (updateFields.bio !== undefined) profile.bio = updateFields.bio;
  if (updateFields.dateOfBirth !== undefined) profile.dateOfBirth = updateFields.dateOfBirth;
  if (updateFields.preferredLanguage !== undefined) profile.preferredLanguage = updateFields.preferredLanguage;

  // Re-evaluate onboarding completion automatically on backend
  profile.checkOnboardingCompletion();

  await profile.save();
  return profile;
};

/**
 * Replaces or registers the player's sports profiles
 */
export const updateSports = async (authUserId, sportsList) => {
  const profile = await getMyProfile(authUserId);

  profile.sportsProfiles = sportsList;
  profile.checkOnboardingCompletion();

  await profile.save();
  return profile;
};

/**
 * Removes a registered sport by sport name
 */
export const removeSport = async (authUserId, sportName) => {
  const profile = await getMyProfile(authUserId);
  const normalized = sportName.toLowerCase().trim();

  const originalLength = profile.sportsProfiles.length;
  profile.sportsProfiles = profile.sportsProfiles.filter((s) => s.sport !== normalized);

  if (profile.sportsProfiles.length === originalLength) {
    const err = new Error(`Sport '${sportName}' is not registered on this profile`);
    err.statusCode = 404;
    throw err;
  }

  profile.checkOnboardingCompletion();
  await profile.save();
  return profile;
};

/**
 * Updates location and calculates Uber H3 index on the backend
 */
export const updateLocation = async (authUserId, locationData) => {
  const profile = await getMyProfile(authUserId);

  if (locationData.coordinates) {
    const [lng, lat] = locationData.coordinates;
    profile.location.geo = {
      type: "Point",
      coordinates: [lng, lat],
    };

    // Calculate Uber H3 index securely on backend
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
  const profile = await getMyProfile(authUserId);

  profile.availability.status = status;
  profile.availability.updatedAt = new Date();

  await profile.save();
  return profile;
};

/**
 * Updates discovery & notification preferences
 */
export const updatePreferences = async (authUserId, preferencesData) => {
  const profile = await getMyProfile(authUserId);

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

  const profile = await getMyProfile(authUserId);

  try {
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      folder: "sport_app/avatars",
      resource_type: "image",
    });

    // Delete previous avatar from Cloudinary if it was a custom upload
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
    // Always clean up local temporary upload file
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

  const profile = await getMyProfile(authUserId);
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
  const profile = await getMyProfile(authUserId);
  if (profile.fcmTokens && token) {
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
  // Query primarily by authUser ID, or by profile _id as fallback
  let profile = await UserProfile.findOne({
    $or: [{ authUser: targetUserId }, { _id: targetUserId }],
  }).populate("authUser", "username");

  if (!profile) {
    const err = new Error("Player profile not found");
    err.statusCode = 404;
    throw err;
  }

  // Construct safe public view
  return {
    id: profile._id,
    userId: profile.authUser?._id || profile.authUser,
    username: profile.authUser?.username || null,
    displayName: profile.displayName,
    avatar: {
      url: profile.avatar?.url || "default-avatar",
    },
    bio: profile.bio || "",
    preferredLanguage: profile.preferredLanguage || "en",
    sportsProfiles: profile.sportsProfiles || [],
    availability: {
      status: profile.availability?.status || "offline",
    },
    location: {
      city: profile.location?.city || "",
      state: profile.location?.state || "",
      country: profile.location?.country || "",
      // Notice: EXACT GPS coordinates & h3Index are NEVER exposed publicly
    },
    onboardingCompleted: profile.onboardingCompleted,
    createdAt: profile.createdAt,
  };
};

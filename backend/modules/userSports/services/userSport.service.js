import { UserSport } from "../models/userSport.model.js";
import { Sport } from "../../sports/models/sport.model.js";
import { UserProfile } from "../../user/models/userProfile.model.js";
import { validateUserSportInput } from "../validations/userSport.validation.js";
import { EXPERIENCE_RATING } from "../../../config/sports.config.js";

/**
 * Resolves a Sport document by either its slug or ObjectId
 */
export const resolveSportDoc = async (sportIdentifier) => {
  if (!sportIdentifier) {
    const err = new Error("Sport identifier is required");
    err.statusCode = 400;
    throw err;
  }

  let sportDoc;
  const raw = String(sportIdentifier).trim();

  // Try finding by slug first (normalized)
  sportDoc = await Sport.findOne({ slug: raw.toLowerCase(), isActive: true });

  // If not found and raw looks like ObjectId, try finding by _id
  if (!sportDoc && raw.match(/^[0-9a-fA-F]{24}$/)) {
    sportDoc = await Sport.findOne({ _id: raw, isActive: true });
  }

  if (!sportDoc) {
    const err = new Error(`Sport '${sportIdentifier}' is not found in authoritative sports catalogue`);
    err.statusCode = 404;
    throw err;
  }

  return sportDoc;
};

/**
 * Returns all registered sports for the authenticated user
 */
export const getUserSports = async (authUserId) => {
  const userSports = await UserSport.find({ authUser: authUserId })
    .populate("sport", "name slug hasPositions positions")
    .sort({ isPrimarySport: -1, createdAt: 1 });

  return userSports.map((us) => {
    const obj = us.toObject();
    obj.experienceCategory = EXPERIENCE_RATING.getCategory(us.experienceLevel);
    return obj;
  });
};

/**
 * Adds a new registered sport for the authenticated user
 */
export const addUserSport = async (authUserId, sportIdentifier, data) => {
  const sportDoc = await resolveSportDoc(sportIdentifier);

  // 1. Validate payload against sport configuration
  const validation = validateUserSportInput(data, sportDoc, false);
  if (!validation.isValid) {
    const err = new Error(validation.errors.join("; "));
    err.statusCode = 400;
    err.errors = validation.errors;
    throw err;
  }

  // 2. Check for duplicate sport registration
  const existing = await UserSport.findOne({ authUser: authUserId, sport: sportDoc._id });
  if (existing) {
    const err = new Error(`Sport '${sportDoc.name}' is already registered for your account. Use PATCH to update it.`);
    err.statusCode = 409;
    throw err;
  }

  // 3. Primary sport enforcement
  const existingCount = await UserSport.countDocuments({ authUser: authUserId });
  let isPrimary = Boolean(validation.sanitized.isPrimarySport);

  // If this is user's first sport, make it primary automatically
  if (existingCount === 0) {
    isPrimary = true;
  } else if (isPrimary) {
    // Demote any existing primary sport
    await UserSport.updateMany({ authUser: authUserId }, { $set: { isPrimarySport: false } });
  }

  // 4. Create UserSport document
  const userSport = await UserSport.create({
    authUser: authUserId,
    sport: sportDoc._id,
    experienceLevel: validation.sanitized.experienceLevel,
    preferredPositions: validation.sanitized.preferredPositions,
    isPrimarySport: isPrimary,
  });

  // 5. Update UserProfile onboarding completion
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (profile) {
    await profile.checkOnboardingCompletion(true);
    await profile.save();
  }

  await userSport.populate("sport", "name slug hasPositions positions");
  const result = userSport.toObject();
  result.experienceCategory = EXPERIENCE_RATING.getCategory(userSport.experienceLevel);
  return result;
};

/**
 * Updates an existing registered sport for the authenticated user
 */
export const updateUserSport = async (authUserId, sportIdentifier, data) => {
  const sportDoc = await resolveSportDoc(sportIdentifier);

  const userSport = await UserSport.findOne({ authUser: authUserId, sport: sportDoc._id });
  if (!userSport) {
    const err = new Error(`Sport '${sportDoc.name}' is not registered for your account.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. Validate patch payload
  const validation = validateUserSportInput(data, sportDoc, true);
  if (!validation.isValid) {
    const err = new Error(validation.errors.join("; "));
    err.statusCode = 400;
    err.errors = validation.errors;
    throw err;
  }

  // 2. Update fields
  if (validation.sanitized.experienceLevel !== undefined) {
    userSport.experienceLevel = validation.sanitized.experienceLevel;
  }

  if (validation.sanitized.preferredPositions !== undefined) {
    userSport.preferredPositions = validation.sanitized.preferredPositions;
  }

  if (validation.sanitized.isPrimarySport !== undefined) {
    const newPrimary = validation.sanitized.isPrimarySport;
    if (newPrimary && !userSport.isPrimarySport) {
      // Unset previous primary sport
      await UserSport.updateMany({ authUser: authUserId }, { $set: { isPrimarySport: false } });
      userSport.isPrimarySport = true;
    } else if (!newPrimary && userSport.isPrimarySport) {
      // If demoting current primary, check if other sports exist and pick one as primary
      userSport.isPrimarySport = false;
      const otherSport = await UserSport.findOne({
        authUser: authUserId,
        _id: { $ne: userSport._id },
      });
      if (otherSport) {
        otherSport.isPrimarySport = true;
        await otherSport.save();
      }
    }
  }

  await userSport.save();
  await userSport.populate("sport", "name slug hasPositions positions");

  const result = userSport.toObject();
  result.experienceCategory = EXPERIENCE_RATING.getCategory(userSport.experienceLevel);
  return result;
};

/**
 * Deletes a registered sport for the authenticated user
 */
export const deleteUserSport = async (authUserId, sportIdentifier) => {
  const sportDoc = await resolveSportDoc(sportIdentifier);

  const userSport = await UserSport.findOne({ authUser: authUserId, sport: sportDoc._id });
  if (!userSport) {
    const err = new Error(`Sport '${sportDoc.name}' is not registered for your account.`);
    err.statusCode = 404;
    throw err;
  }

  const wasPrimary = userSport.isPrimarySport;
  await UserSport.findByIdAndDelete(userSport._id);

  // If deleted sport was primary, promote first remaining sport
  if (wasPrimary) {
    const nextSport = await UserSport.findOne({ authUser: authUserId }).sort({ createdAt: 1 });
    if (nextSport) {
      nextSport.isPrimarySport = true;
      await nextSport.save();
    }
  }

  // Check remaining count for onboarding status
  const remainingCount = await UserSport.countDocuments({ authUser: authUserId });
  const profile = await UserProfile.findOne({ authUser: authUserId });
  if (profile) {
    await profile.checkOnboardingCompletion(remainingCount > 0);
    await profile.save();
  }

  return {
    deletedSport: sportDoc.name,
    remainingSportsCount: remainingCount,
  };
};

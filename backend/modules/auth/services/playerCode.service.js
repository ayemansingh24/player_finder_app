import { User } from "../models/user.model.js";
import { PlayerCodeRegistry } from "../models/playerCodeRegistry.model.js";
import { allocatePlayerCode, generatePlayerCode } from "../../../utils/playerCodeGenerator.js";

/**
 * Service to allocate a unique, permanent Player Code backed by
 * the PlayerCodeRegistry model and retry loop.
 *
 * @param {number} [digits=7]
 * @param {number} [maxRetries=10]
 * @returns {Promise<string>}
 */
export const allocateUniquePlayerCode = async (digits = 7, maxRetries = 10) => {
  return await allocatePlayerCode(User, PlayerCodeRegistry, digits, maxRetries);
};

export { generatePlayerCode };

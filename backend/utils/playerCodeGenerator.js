import { randomInt } from "crypto";

/**
 * Generates a numeric player code with no leading zero.
 * @param {number} digits - Number of digits (7–10)
 * @returns {string}
 */
export function generatePlayerCode(digits = 7) {
  const clampedDigits = Math.min(Math.max(Math.floor(digits), 7), 10);

  // First digit: 1-9 (no leading zero)
  const firstDigit = randomInt(1, 10); // randomInt(min, max) is exclusive of max
  // Remaining digits: 0-9
  const remaining = Array.from({ length: clampedDigits - 1 }, () =>
    randomInt(0, 10)
  ).join("");

  return `${firstDigit}${remaining}`;
}

/**
 * Allocates a unique playerCode by trying up to maxRetries times.
 * Escalates digit count (7→8→9→10) after 3 collisions at the same length.
 *
 * @param {import('mongoose').Model} UserModel       - The Mongoose User model
 * @param {import('mongoose').Model} RegistryModel   - The PlayerCodeRegistry model
 * @param {number} digits                            - Starting digit count (default 7)
 * @param {number} maxRetries                        - Total retry budget (default 10)
 * @returns {Promise<string>}                        - The allocated player code
 * @throws {Error} if the retry budget is exhausted
 */
export async function allocatePlayerCode(
  UserModel,
  RegistryModel,
  digits = 7,
  maxRetries = 10
) {
  let currentDigits = Math.min(Math.max(Math.floor(digits), 7), 10);
  let collisionsAtCurrentLength = 0;
  const ESCALATE_AFTER = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generatePlayerCode(currentDigits);

    try {
      // Reserve the code in the registry atomically.
      // This throws a duplicate-key error (code 11000) if already reserved.
      await RegistryModel.create({ playerCode: code, allocatedAt: new Date() });
      return code;
    } catch (err) {
      // Only retry on duplicate-key collision specifically on playerCode
      const isDuplicatePlayerCode =
        err.code === 11000 &&
        (err.keyPattern?.playerCode !== undefined ||
          err.message?.toLowerCase().includes("playercode"));

      if (!isDuplicatePlayerCode) {
        // Unexpected error — re-throw immediately
        throw err;
      }

      collisionsAtCurrentLength++;

      // Escalate digit count after 3 consecutive collisions at this length
      if (
        collisionsAtCurrentLength >= ESCALATE_AFTER &&
        currentDigits < 10
      ) {
        currentDigits++;
        collisionsAtCurrentLength = 0;
      }
    }
  }

  throw new Error(
    `Player code allocation failed after ${maxRetries} attempts. ` +
      `The code space at ${currentDigits} digits may be saturated. ` +
      "Please contact support."
  );
}

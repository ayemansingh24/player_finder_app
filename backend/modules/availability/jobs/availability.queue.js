import { Queue } from "bullmq";
import { bullmqConnection } from "../../../config/bullmq.js";
import { isRedisReady } from "../../../config/redis.js";

let availabilityQueue = null;

try {
  availabilityQueue = new Queue("availability-transitions", {
    connection: bullmqConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  });
} catch (err) {
  console.warn("⚠️ Failed to initialize availability Queue:", err.message);
}

/**
 * Schedules a delayed job for an upcoming availability transition.
 *
 * @param {string} userId
 * @param {Date} transitionDate
 * @param {number} scheduleVersion
 */
export const scheduleAvailabilityTransition = async (userId, transitionDate, scheduleVersion) => {
  if (!availabilityQueue || !isRedisReady()) {
    return; // Soft fallback: effective availability is dynamically evaluated during Discovery anyway
  }

  const delayMs = Math.max(0, new Date(transitionDate).getTime() - Date.now());
  const jobId = `avail_${userId}_v${scheduleVersion}_${new Date(transitionDate).getTime()}`;

  try {
    await availabilityQueue.add(
      "transition",
      { userId, scheduleVersion, transitionDate },
      { delay: delayMs, jobId }
    );
  } catch (err) {
    console.warn("⚠️ Error scheduling BullMQ availability transition:", err.message);
  }
};

export { availabilityQueue };
export default availabilityQueue;

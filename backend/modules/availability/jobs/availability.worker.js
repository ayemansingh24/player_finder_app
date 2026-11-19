import { Worker } from "bullmq";
import { bullmqConnection } from "../../../config/bullmq.js";
import { UserProfile } from "../../user/models/userProfile.model.js";
import { getEffectiveAvailability } from "../utils/availabilityCalculator.js";

let availabilityWorker = null;

export const startAvailabilityWorker = () => {
  if (availabilityWorker) return availabilityWorker;

  try {
    availabilityWorker = new Worker(
      "availability-transitions",
      async (job) => {
        const { userId, scheduleVersion } = job.data;
        if (!userId) return;

        const profile = await UserProfile.findOne({ authUser: userId });
        if (!profile) return;

        // Discard stale jobs if schedule version has changed
        if (
          profile.availability.scheduleVersion !== undefined &&
          scheduleVersion !== undefined &&
          profile.availability.scheduleVersion !== scheduleVersion
        ) {
          return { skipped: true, reason: "stale_schedule_version" };
        }

        // Recompute current effective availability
        const effective = getEffectiveAvailability(profile, new Date());

        if (profile.availability.status !== effective.effectiveStatus) {
          profile.availability.status = effective.effectiveStatus;
          profile.availability.updatedAt = new Date();
          await profile.save();
        }

        return {
          userId,
          newStatus: effective.effectiveStatus,
          reason: effective.reason,
        };
      },
      {
        connection: bullmqConnection,
        concurrency: 5,
      }
    );

    availabilityWorker.on("completed", (job, result) => {
      // Completed job
    });

    availabilityWorker.on("failed", (job, err) => {
      console.warn(`⚠️ Availability job ${job?.id} failed:`, err.message);
    });

    console.log("👷 Availability BullMQ Worker started");
    return availabilityWorker;
  } catch (err) {
    console.warn("⚠️ Failed to start availability BullMQ Worker:", err.message);
    return null;
  }
};

export { availabilityWorker };
export default startAvailabilityWorker;

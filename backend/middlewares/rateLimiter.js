import { redisClient, isRedisReady } from "../config/redis.js";

// In-memory fallback if Redis is temporarily unreachable
const inMemoryStore = new Map();

/**
 * Creates a rate-limiter middleware.
 * Uses Redis sliding-window counter when connected, falling back to in-memory counter.
 *
 * @param {Object} options
 * @param {string} options.prefix - Key prefix, e.g. 'search:playercode'
 * @param {number} options.windowSeconds - Window length in seconds (default 60)
 * @param {number} options.maxRequests - Max allowed requests per window (default 30)
 * @param {string} [options.identifier='userOrIp'] - 'userOrIp' | 'userOnly' | 'ipOnly'
 */
export const createRateLimiter = ({
  prefix,
  windowSeconds = 60,
  maxRequests = 30,
  identifier = "userOrIp",
}) => {
  return async (req, res, next) => {
    let keyId;
    if (identifier === "userOnly") {
      keyId = req.user?._id?.toString();
      if (!keyId) return next(); // Not authenticated, skip or let auth middleware handle
    } else if (identifier === "ipOnly") {
      keyId = req.ip || req.connection?.remoteAddress || "unknown_ip";
    } else {
      keyId = req.user?._id?.toString() || req.ip || "anon";
    }

    const key = `ratelimit:${prefix}:${keyId}`;

    if (isRedisReady() && redisClient) {
      try {
        const current = await redisClient.incr(key);
        if (current === 1) {
          await redisClient.expire(key, windowSeconds);
        }

        const ttl = await redisClient.ttl(key);
        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - current));
        res.setHeader("X-RateLimit-Reset", ttl);

        if (current > maxRequests) {
          return res.status(429).json({
            success: false,
            message: `Rate limit exceeded for ${prefix}. Please try again in ${ttl} seconds.`,
            retryAfterSeconds: ttl,
          });
        }
        return next();
      } catch (redisErr) {
        console.warn("⚠️ Redis rate limiter error, falling back to memory:", redisErr.message);
      }
    }

    // In-memory fallback
    const now = Date.now();
    const entry = inMemoryStore.get(key) || { count: 0, expiresAt: now + windowSeconds * 1000 };

    if (now > entry.expiresAt) {
      entry.count = 1;
      entry.expiresAt = now + windowSeconds * 1000;
    } else {
      entry.count += 1;
    }
    inMemoryStore.set(key, entry);

    const remainingTtl = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", remainingTtl);

    if (entry.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for ${prefix}. Please try again in ${remainingTtl} seconds.`,
        retryAfterSeconds: remainingTtl,
      });
    }

    next();
  };
};

// Preset limiters for key platform actions
export const playerCodeSearchLimiter = createRateLimiter({
  prefix: "search:playercode",
  windowSeconds: 60,
  maxRequests: 20, // 20 lookups per minute prevents enumeration
});

export const playerDiscoveryLimiter = createRateLimiter({
  prefix: "discovery:players",
  windowSeconds: 60,
  maxRequests: 30,
});

export const teamDiscoveryLimiter = createRateLimiter({
  prefix: "discovery:teams",
  windowSeconds: 60,
  maxRequests: 30,
});

export const invitationCreationLimiter = createRateLimiter({
  prefix: "invitations:create",
  windowSeconds: 60,
  maxRequests: 20,
});

export const locationUpdateLimiter = createRateLimiter({
  prefix: "location:update",
  windowSeconds: 60,
  maxRequests: 15,
});

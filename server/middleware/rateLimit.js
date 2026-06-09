const { errorResponse } = require('./response');

const buckets = new Map();

function getClientIp(req) {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs, max, keyPrefix = 'rate-limit', keyGenerator = null, skip = null }) {
    return (req, res, next) => {
        if (skip && skip(req)) {
            return next();
        }

        const now = Date.now();
        const keySuffix = keyGenerator ? keyGenerator(req) : getClientIp(req);
        const key = `${keyPrefix}:${keySuffix}`;
        const current = buckets.get(key);

        if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        current.count += 1;
        if (current.count > max) {
            res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
            return errorResponse(res, 'Too many requests. Please try again later.', 429);
        }

        return next();
    };
}

function pruneRateLimitBuckets() {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }
}

setInterval(pruneRateLimitBuckets, 60 * 1000).unref();

module.exports = { createRateLimiter };

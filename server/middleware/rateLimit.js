const { errorResponse } = require('./response');

const buckets = new Map();

function getClientIp(req) {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs, max, keyPrefix = 'rate-limit', keyGenerator = null, skip = null }) {
    return (req, res, next) => {
        try {
            if (skip && skip(req)) {
                return next();
            }
        } catch (e) {
            return next();
        }

        const now = Date.now();
        const keySuffix = keyGenerator ? keyGenerator(req) : getClientIp(req);
        const key = `${keyPrefix}:${keySuffix}`;
        const current = buckets.get(key);

        if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs, createdAt: now });
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

/**
 * 内存桶硬上限：超过 MAX_BUCKETS 时驱逐最早的 20% 桶，
 * 防止攻击者用海量 IP 撑爆内存（DoS）
 */
const MAX_BUCKETS = 10000;

function evictIfFull() {
    if (buckets.size > MAX_BUCKETS) {
        const toDelete = Math.floor(MAX_BUCKETS * 0.2);
        const entries = Array.from(buckets.entries());
        entries.sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
        for (let i = 0; i < toDelete && i < entries.length; i++) {
            buckets.delete(entries[i][0]);
        }
    }
}

setInterval(() => {
    pruneRateLimitBuckets();
    evictIfFull();
}, 60 * 1000).unref();

module.exports = { createRateLimiter };

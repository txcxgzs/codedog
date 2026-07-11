const { errorResponse } = require('./response');

/**
 * 获取客户端 IP
 * 修复 L1: 移除对 X-Forwarded-For 的直接读取回退,统一依赖 Express 的 req.ip(受 trust proxy 控制),
 * 避免在未配置 trust proxy 时被伪造 XFF 头绕过限流
 */
function getClientIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * 内存桶硬上限:超过 MAX_BUCKETS 时驱逐最早的 20% 桶,
 * 防止攻击者用海量 IP 撑爆内存(DoS)
 */
const MAX_BUCKETS = 10000;

function createRateLimiter({ windowMs, max, keyPrefix = 'rate-limit', keyGenerator = null, skip = null }) {
    // 修复 H4: 每个限流器实例使用独立的 buckets Map,避免不同限流器之间相互驱逐
    const buckets = new Map();

    const pruneBuckets = () => {
        const now = Date.now();
        for (const [key, bucket] of buckets.entries()) {
            if (bucket.resetAt <= now) {
                buckets.delete(key);
            }
        }
    };

    const evictIfFull = () => {
        if (buckets.size > MAX_BUCKETS) {
            const toDelete = Math.floor(MAX_BUCKETS * 0.2);
            const entries = Array.from(buckets.entries());
            entries.sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
            for (let i = 0; i < toDelete && i < entries.length; i++) {
                buckets.delete(entries[i][0]);
            }
        }
    };

    // 定时清理与驱逐(只作用于本限流器的 buckets)
    const timer = setInterval(() => {
        pruneBuckets();
        evictIfFull();
    }, 60 * 1000);
    if (timer.unref && typeof timer.unref === 'function') {
        timer.unref();
    }

    return (req, res, next) => {
        try {
            if (skip && skip(req)) {
                return next();
            }
        } catch (e) {
            return next();
        }

        const now = Date.now();
        // 修复: keyGenerator 异常时回退到 IP 维度,与 skip 的异常保护一致
        let keySuffix;
        try {
            keySuffix = keyGenerator ? keyGenerator(req) : getClientIp(req);
        } catch (e) {
            keySuffix = getClientIp(req);
        }
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

module.exports = { createRateLimiter };

/**
 * IP 封禁中间件
 * 修复: 原先 adminController 只写 IpBan 记录,运行时无任何拦截,被封禁 IP 仍能正常访问
 * 现在在全局路由前注册此中间件,拦截被封禁 IP 的所有请求
 *
 * 缓存策略: 60 秒内存缓存,与 hCaptcha 中间件保持一致
 * 当管理员解封 IP 时,可通过 admin API 调用 invalidateIpBanCache() 立即生效
 */

const { Op } = require('sequelize');
const DbAdapter = require('../utils/dbAdapter');
const { IpBan } = require('../models');

// 内存缓存: { [ip]: { banned: boolean, expires_at: Date|null, cachedAt: number } }
const banCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 秒

/**
 * 查询 IP 是否被封禁(带缓存)
 * @param {string} ip - 客户端 IP
 * @returns {Promise<{banned: boolean, reason?: string}>}
 */
async function checkIpBanned(ip) {
    if (!ip) return { banned: false };

    // 查缓存
    const cached = banCache.get(ip);
    if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL) {
        // 永久封禁或缓存未过期,直接返回缓存结果
        if (cached.banned) {
            // 检查缓存的封禁是否已过期
            if (cached.expires_at && new Date(cached.expires_at).getTime() <= Date.now()) {
                banCache.delete(ip);
                return { banned: false };
            }
            return { banned: true, reason: cached.reason };
        }
        return { banned: false };
    }

    // 查数据库
    try {
        const ban = await DbAdapter.findOne(IpBan, {
            where: {
                ip,
                [Op.or]: [
                    { expires_at: null },
                    { expires_at: { [Op.gt]: new Date() } }
                ]
            }
        });

        const result = ban
            ? { banned: true, reason: ban.reason }
            : { banned: false };

        // 写缓存
        banCache.set(ip, {
            banned: result.banned,
            reason: result.reason,
            expires_at: ban ? ban.expires_at : null,
            cachedAt: Date.now()
        });

        return result;
    } catch (error) {
        // 数据库故障时 fail-closed: 拒绝请求,避免被封禁 IP 在 DB 异常时绕过封禁
        console.error('[IpBan] 检查 IP 封禁状态失败:', error.message);
        throw error;
    }
}

/**
 * 使 IP 封禁缓存失效(管理员解封/封禁时调用)
 * @param {string} [ip] - 指定 IP,不传则清空所有缓存
 */
function invalidateIpBanCache(ip) {
    if (ip) {
        banCache.delete(ip);
    } else {
        banCache.clear();
    }
}

/**
 * IP 封禁中间件
 * 置于限流和业务路由之前,被封禁 IP 直接返回 403
 */
async function ipBanMiddleware(req, res, next) {
    // 静态资源(非 /api)不拦截,避免影响前端资源加载
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    const ip = req.ip;
    if (!ip) {
        return next();
    }

    try {
        const { banned, reason } = await checkIpBanned(ip);
        if (banned) {
            return res.status(403).json({
                code: 403,
                msg: '当前 IP 已被封禁' + (reason ? ': ' + reason : ''),
                data: null
            });
        }
        next();
    } catch (error) {
        // fail-closed: DB 故障时拒绝请求
        return res.status(503).json({
            code: 503,
            msg: '服务暂时不可用,请稍后重试',
            data: null
        });
    }
}

module.exports = { ipBanMiddleware, invalidateIpBanCache, checkIpBanned };

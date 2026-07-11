const jwt = require('jsonwebtoken');
const { isRoleAtLeast } = require('../config/permissions');
const { JWT_SECRET, JWT_COOKIE_NAME, JWT_EXPIRES_IN } = require('../config/auth');
const { errorResponse } = require('./response');
const { User } = require('../models');
const DbAdapter = require('../utils/dbAdapter');

/**
 * 从 Authorization 头解析 Bearer token
 * 修复 L10: 用正则替代 split(' '),避免多空格/异常输入导致解析失败
 * 修复: 添加 token 长度上限(4096),防止异常长字符串消耗 CPU/JWT 解析时间
 * 修复: 字符集校验,只接受 base64url 字符(a-zA-Z0-9-_.)+JWT 必需的 . 分隔符
 */
function getBearerToken(req) {
    const header = req.headers.authorization || '';
    const match = header.match(/^bearer\s+([a-zA-Z0-9._-]+)$/i);
    if (!match) return null;
    // JWT 实际长度通常 100-500 字节,4096 是合理上限(给超长自定义 token 留余量)
    if (match[1].length > 4096) return null;
    return match[1];
}

/**
 * 手动解析 Cookie 头,提取指定名称的 value
 * 不依赖 cookie-parser,降低依赖体积
 * 安全:只接受 base64url/JWT 字符集,避免任何异常输入
 */
function parseCookieToken(req, cookieName) {
    const cookieHeader = req.headers.cookie || '';
    if (!cookieHeader) return null;
    // 拆分时跳过空段,防止恶意 ";;" 攻击
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const eqIdx = part.indexOf('=');
        if (eqIdx < 0) continue;
        const name = part.slice(0, eqIdx).trim();
        if (name !== cookieName) continue;
        const value = part.slice(eqIdx + 1).trim();
        // URL-decode 同源浏览器自动做的
        let decoded;
        try {
            decoded = decodeURIComponent(value);
        } catch (e) {
            return null;
        }
        if (!/^[a-zA-Z0-9._-]+$/.test(decoded)) return null;
        if (decoded.length > 4096) return null;
        return decoded;
    }
    return null;
}

/**
 * 解析 token 的统一入口: 优先读 httpOnly cookie, 后备读 Authorization 头
 * 顺序: cookie 优先(防 XSS 偷), header 兼容旧版前端和外部 API 调用
 */
function getToken(req) {
    return parseCookieToken(req, JWT_COOKIE_NAME) || getBearerToken(req);
}

/**
 * 计算 JWT 过期时间对应的 cookie Max-Age(秒)
 * 支持 '7d' / '24h' / '60s' / 数字秒
 */
function getCookieMaxAge() {
    const exp = String(JWT_EXPIRES_IN || '7d');
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // 默认 7 天
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] || 86400;
    return n * multiplier;
}

/**
 * 把 token 写入 httpOnly cookie
 * - httpOnly: JS 读不到,防 XSS 偷 token
 * - sameSite=Lax: 阻止跨站 POST, 防 CSRF; 但允许站内 GET
 * - secure: 生产环境 true(HTTPS), 开发环境 false(HTTP 调试)
 * - maxAge 与 JWT 过期一致, 浏览器关页面不会丢(除非过期)
 */
function setTokenCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production';
    const parts = [
        `${JWT_COOKIE_NAME}=${encodeURIComponent(token)}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=${getCookieMaxAge()}`,
    ];
    if (isProduction) {
        parts.push('Secure');
    }
    res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * 清除 token cookie(登出用)
 * 设为过去时间,浏览器立即删除
 */
function clearTokenCookie(res) {
    const parts = [
        `${JWT_COOKIE_NAME}=`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=0`,
    ];
    if (process.env.NODE_ENV === 'production') {
        parts.push('Secure');
    }
    res.setHeader('Set-Cookie', parts.join('; '));
}

async function resolveUserFromToken(token) {
    // 修复 H3: 显式指定 algorithms,防止 alg=none 攻击及算法混淆攻击
    const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'codedog-community',
        audience: 'codedog-frontend'
    });
    const user = await DbAdapter.findByPk(User, decoded.id);

    if (!user) {
        const error = new Error('USER_NOT_FOUND');
        error.statusCode = 401;
        throw error;
    }

    if (user.status !== 'active') {
        const error = new Error('USER_DISABLED');
        error.statusCode = 403;
        throw error;
    }

    if (decoded.token_version !== undefined && decoded.token_version !== (user.token_version || 0)) {
        const error = new Error('TOKEN_REVOKED');
        error.statusCode = 401;
        throw error;
    }

    return {
        id: DbAdapter.getId(user),
        username: user.username,
        role: user.role,
        status: user.status,
        codemao_user_id: user.codemao_user_id
    };
}

async function authMiddleware(req, res, next) {
    const token = getToken(req);

    if (!token) {
        return res.status(401).json({
            code: 401,
            msg: '请先登录',
            data: null
        });
    }

    try {
        req.user = await resolveUserFromToken(token);
        next();
    } catch (error) {
        const statusCode = error.statusCode || 401;
        return res.status(statusCode).json({
            code: statusCode,
            msg: statusCode === 403 ? '账号已被禁用' : '登录已过期，请重新登录',
            data: null
        });
    }
}

async function optionalAuth(req, res, next) {
    const token = getToken(req);

    if (token) {
        try {
            req.user = await resolveUserFromToken(token);
        } catch (error) {
            // 修复 M6: 仅 JWT 类错误(签名/过期)静默降级为游客;DB 等其他故障返回 503
            // 修复: 补充 NotBeforeError 捕获,该错误也是 JWT 类错误应按游客处理
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
                // 令牌无效或过期,按游客处理
            } else if (error.statusCode === 401 || error.statusCode === 403) {
                // 用户不存在/被禁用,也按游客处理(保持原有行为)
            } else {
                console.error('optionalAuth服务故障:', error.message);
                return errorResponse(res, '认证服务暂不可用', 503);
            }
        }
    }

    next();
}

/**
 * 管理后台权限中间件（reviewer 及以上）
 * 修复: 原先要求 admin+,导致 reviewer/moderator 的细粒度权限完全失效。
 * 现改为 reviewer+ 即可进入后台,由各路由的 requirePermission 做细粒度控制。
 * 无 requirePermission 保护的路由需自行补上 requireRole('admin') 或 requirePermission。
 */
function adminMiddleware(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            code: 401,
            msg: '请先登录',
            data: null
        });
    }
    if (!isRoleAtLeast(req.user.role, 'reviewer')) {
        return res.status(403).json({
            code: 403,
            msg: '权限不足，需要管理员或以上权限',
            data: null
        });
    }
    next();
}

/**
 * 审核员及以上权限中间件
 */
function reviewerOrAboveMiddleware(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            code: 401,
            msg: '请先登录',
            data: null
        });
    }
    if (!isRoleAtLeast(req.user.role, 'reviewer')) {
        return res.status(403).json({
            code: 403,
            msg: '权限不足，需要审核员或以上权限',
            data: null
        });
    }
    next();
}

module.exports = { authMiddleware, adminMiddleware, optionalAuth, reviewerOrAboveMiddleware, setTokenCookie, clearTokenCookie };

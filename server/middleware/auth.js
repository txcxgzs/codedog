const jwt = require('jsonwebtoken');
const { isRoleAtLeast } = require('../config/permissions');
const { JWT_SECRET } = require('../config/auth');
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
    const token = getBearerToken(req);

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
    const token = getBearerToken(req);

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

module.exports = { authMiddleware, adminMiddleware, optionalAuth, reviewerOrAboveMiddleware };

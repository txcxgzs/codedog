const jwt = require('jsonwebtoken');
const { isRoleAtLeast } = require('../config/permissions');
const { JWT_SECRET } = require('../config/auth');
const { errorResponse } = require('./response');
const { User } = require('../models');
const DbAdapter = require('../utils/dbAdapter');

/**
 * 从 Authorization 头解析 Bearer token
 * 修复 L10: 用正则替代 split(' '),避免多空格/异常输入导致解析失败
 */
function getBearerToken(req) {
    const header = req.headers.authorization || '';
    const match = header.match(/^bearer\s+(.+)$/i);
    return match ? match[1] : null;
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
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
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
 * 管理员权限中间件（admin 及以上）
 */
function adminMiddleware(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            code: 401,
            msg: '请先登录',
            data: null
        });
    }
    if (!isRoleAtLeast(req.user.role, 'admin')) {
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

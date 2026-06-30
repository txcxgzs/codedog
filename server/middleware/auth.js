const jwt = require('jsonwebtoken');
const { isRoleAtLeast } = require('../config/permissions');
const { JWT_SECRET } = require('../config/auth');
const { User } = require('../models');
const DbAdapter = require('../utils/dbAdapter');

function getBearerToken(req) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (!token || scheme.toLowerCase() !== 'bearer') {
        return null;
    }
    return token;
}

async function resolveUserFromToken(token) {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'codedog-community', audience: 'codedog-frontend' });
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
            if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
                console.error('optionalAuth非令牌错误:', error.message);
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

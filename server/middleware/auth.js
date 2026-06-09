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
    const decoded = jwt.verify(token, JWT_SECRET);
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
            // Public endpoints should still work when an optional token is invalid.
        }
    }

    next();
}

function adminMiddleware(req, res, next) {
    if (!isRoleAtLeast(req.user.role, 'reviewer')) {
        return res.status(403).json({
            code: 403,
            msg: '权限不足，需要管理员权限',
            data: null
        });
    }
    next();
}

module.exports = { authMiddleware, adminMiddleware, optionalAuth };

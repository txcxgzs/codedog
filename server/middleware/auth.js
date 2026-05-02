/**
 * JWT认证中间件
 * 验证用户Token，保护需要登录的路由
 */

const jwt = require('jsonwebtoken');
const { isRoleAtLeast } = require('../config/permissions');
const { JWT_SECRET } = require('../config/auth');

// 认证中间件
function authMiddleware(req, res, next) {
    // 从请求头获取Token
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            code: 401,
            msg: '请先登录',
            data: null
        });
    }
    
    try {
        // 验证Token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            code: 401,
            msg: '登录已过期，请重新登录',
            data: null
        });
    }
}

// 可选认证中间件（有token则解析，无token也放行）
function optionalAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // Token无效但不阻止请求
        }
    }
    next();
}

// 管理员权限中间件（包括审核员及以上角色）
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
            msg: '权限不足，需要管理员权限',
            data: null
        });
    }
    next();
}

module.exports = { authMiddleware, adminMiddleware, optionalAuth };

/**
 * 权限检查中间件
 */

const { hasPermission, isRoleAtLeast, canManageUser } = require('../config/permissions');
const { errorResponse } = require('./response');

/**
 * 检查用户是否有指定权限
 * @param {string} permission - 权限标识
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, '请先登录', 401);
        }
        
        if (!hasPermission(req.user.role, permission)) {
            return errorResponse(res, '您没有权限执行此操作', 403);
        }
        
        next();
    };
}

/**
 * 检查用户角色是否达到指定级别
 * @param {string} minRole - 最低角色要求
 */
function requireRole(minRole) {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, '请先登录', 401);
        }
        
        if (!isRoleAtLeast(req.user.role, minRole)) {
            return errorResponse(res, '您没有权限执行此操作', 403);
        }
        
        next();
    };
}

/**
 * 检查是否为管理员（admin 及以上）
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return errorResponse(res, '请先登录', 401);
    }
    
    if (!isRoleAtLeast(req.user.role, 'admin')) {
        return errorResponse(res, '需要管理员权限', 403);
    }
    
    next();
}

/**
 * 检查是否为超级管理员
 */
function requireSuperAdmin(req, res, next) {
    if (!req.user) {
        return errorResponse(res, '请先登录', 401);
    }
    
    if (req.user.role !== 'superadmin') {
        return errorResponse(res, '需要超级管理员权限', 403);
    }
    
    next();
}

module.exports = {
    requirePermission,
    requireRole,
    requireAdmin,
    requireSuperAdmin
};

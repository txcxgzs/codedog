/**
 * 角色权限配置
 * 支持从数据库读取自定义权限
 */

const DEFAULT_ROLES = {
    user: {
        name: '普通用户',
        level: 0,
        permissions: []
    },
    reviewer: {
        name: '审核员',
        level: 1,
        permissions: [
            'report:view',
            'report:handle',
            'work:review',
            'comment:review',
            'post:review'
        ]
    },
    moderator: {
        name: '版主',
        level: 2,
        permissions: [
            'report:view',
            'report:handle',
            'work:review',
            'work:delete',
            'work:feature',
            'comment:review',
            'comment:delete',
            'post:review',
            'post:delete',
            'post:sticky',
            'post:lock',
            'user:warn',
            'announcement:view'
        ]
    },
    admin: {
        name: '管理员',
        level: 3,
        permissions: [
            'report:view',
            'report:handle',
            'work:review',
            'work:delete',
            'work:feature',
            'work:edit',
            'comment:review',
            'comment:delete',
            'post:review',
            'post:delete',
            'post:sticky',
            'post:lock',
            'post:edit',
            'user:view',
            'user:edit',
            'user:disable',
            'user:warn',
            'announcement:view',
            'announcement:create',
            'announcement:edit',
            'announcement:delete',
            'banner:view',
            'banner:create',
            'banner:edit',
            'banner:delete',
            'statistics:view',
            'crawl:works'
        ]
    },
    superadmin: {
        name: '超级管理员',
        level: 4,
        permissions: ['*']
    }
};

// 所有可用权限列表
const ALL_PERMISSIONS = [
    { key: 'report:view', name: '查看举报', category: '举报管理' },
    { key: 'report:handle', name: '处理举报', category: '举报管理' },
    { key: 'work:review', name: '审核作品', category: '作品管理' },
    { key: 'work:delete', name: '删除作品', category: '作品管理' },
    { key: 'work:feature', name: '精选作品', category: '作品管理' },
    { key: 'work:edit', name: '编辑作品', category: '作品管理' },
    { key: 'comment:review', name: '审核评论', category: '评论管理' },
    { key: 'comment:delete', name: '删除评论', category: '评论管理' },
    { key: 'post:review', name: '审核帖子', category: '帖子管理' },
    { key: 'post:delete', name: '删除帖子', category: '帖子管理' },
    { key: 'post:sticky', name: '置顶帖子', category: '帖子管理' },
    { key: 'post:lock', name: '锁定帖子', category: '帖子管理' },
    { key: 'post:edit', name: '编辑帖子', category: '帖子管理' },
    { key: 'user:view', name: '查看用户', category: '用户管理' },
    { key: 'user:edit', name: '编辑用户', category: '用户管理' },
    { key: 'user:disable', name: '禁用用户', category: '用户管理' },
    { key: 'user:warn', name: '警告用户', category: '用户管理' },
    { key: 'announcement:view', name: '查看公告', category: '公告管理' },
    { key: 'announcement:create', name: '创建公告', category: '公告管理' },
    { key: 'announcement:edit', name: '编辑公告', category: '公告管理' },
    { key: 'announcement:delete', name: '删除公告', category: '公告管理' },
    { key: 'banner:view', name: '查看轮播图', category: '轮播图管理' },
    { key: 'banner:create', name: '创建轮播图', category: '轮播图管理' },
    { key: 'banner:edit', name: '编辑轮播图', category: '轮播图管理' },
    { key: 'banner:delete', name: '删除轮播图', category: '轮播图管理' },
    { key: 'statistics:view', name: '查看统计', category: '系统功能' },
    { key: 'crawl:works', name: '爬取作品', category: '系统功能' },
    { key: 'sensitive:manage', name: '管理敏感词', category: '系统功能' },
    { key: 'config:manage', name: '系统设置', category: '系统功能' },
    { key: 'log:view', name: '查看日志', category: '系统功能' },
    { key: 'role:manage', name: '管理角色权限', category: '系统功能' }
];

// 缓存的角色权限
let cachedRoles = null;

/**
 * 获取角色信息（优先从数据库读取）
 */
async function getRole(roleName, RolePermission = null) {
    if (RolePermission) {
        try {
            const dbRole = await RolePermission.findOne({ where: { role: roleName } });
            if (dbRole) {
                return {
                    name: dbRole.name,
                    level: dbRole.level,
                    permissions: JSON.parse(dbRole.permissions || '[]')
                };
            }
        } catch (e) {
            console.error('从数据库读取角色权限失败:', e);
        }
    }
    return DEFAULT_ROLES[roleName] || DEFAULT_ROLES.user;
}

/**
 * 同步获取角色信息（用于中间件，不访问数据库）
 */
function getRoleSync(roleName) {
    if (cachedRoles && cachedRoles[roleName]) {
        return cachedRoles[roleName];
    }
    return DEFAULT_ROLES[roleName] || DEFAULT_ROLES.user;
}

/**
 * 刷新角色权限缓存
 */
async function refreshRoleCache(RolePermission) {
    try {
        const dbRoles = await RolePermission.findAll();
        cachedRoles = {};
        
        // 先加载默认角色
        Object.entries(DEFAULT_ROLES).forEach(([key, value]) => {
            cachedRoles[key] = value;
        });
        
        // 用数据库中的角色覆盖
        dbRoles.forEach(role => {
            cachedRoles[role.role] = {
                name: role.name,
                level: role.level,
                permissions: JSON.parse(role.permissions || '[]')
            };
        });
        
        return cachedRoles;
    } catch (e) {
        console.error('刷新角色权限缓存失败:', e);
        return DEFAULT_ROLES;
    }
}

/**
 * 检查用户是否有某个权限
 */
function hasPermission(userRole, permission) {
    const role = getRoleSync(userRole);
    if (role.permissions.includes('*')) return true;
    return role.permissions.includes(permission);
}

/**
 * 检查用户角色是否高于或等于目标角色
 */
function isRoleAtLeast(userRole, targetRole) {
    const userLevel = getRoleSync(userRole).level;
    const targetLevel = getRoleSync(targetRole).level;
    return userLevel >= targetLevel;
}

/**
 * 检查用户是否可以管理目标用户
 */
function canManageUser(managerRole, targetRole) {
    const managerLevel = getRoleSync(managerRole).level;
    const targetLevel = getRoleSync(targetRole).level;
    return managerLevel > targetLevel;
}

/**
 * 获取所有角色列表
 */
function getAllRoles() {
    if (cachedRoles) {
        return Object.entries(cachedRoles).map(([key, value]) => ({
            key,
            name: value.name,
            level: value.level,
            permissions: value.permissions
        }));
    }
    return Object.entries(DEFAULT_ROLES).map(([key, value]) => ({
        key,
        name: value.name,
        level: value.level,
        permissions: value.permissions
    }));
}

/**
 * 获取所有可用权限列表
 */
function getAllPermissions() {
    return ALL_PERMISSIONS;
}

/**
 * 获取角色的所有权限（包括通配符展开）
 */
function getRolePermissions(roleName) {
    const role = getRoleSync(roleName);
    if (role.permissions.includes('*')) {
        return ALL_PERMISSIONS.map(p => p.key);
    }
    return role.permissions;
}

module.exports = {
    DEFAULT_ROLES,
    ALL_PERMISSIONS,
    getRole,
    getRoleSync,
    refreshRoleCache,
    hasPermission,
    isRoleAtLeast,
    canManageUser,
    getAllRoles,
    getAllPermissions,
    getRolePermissions
};

/**
 * 后台管理控制器
 */

const { User, Work, Comment, Post, Favorite, Follow, Banner, Report, IpBan, Notification, Announcement, SystemConfig, OperationLog, SensitiveWord, RolePermission, CaptchaStats, Studio, StudioMember, StudioWork, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { getAllRoles, canManageUser, getRole, hasPermission, getAllPermissions, refreshRoleCache, DEFAULT_ROLES } = require('../config/permissions');
const { logOperation } = require('../middleware/operationLog');
const { Op } = require('sequelize');
const codemaoApi = require('../services/codemaoApi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');
const DbAdapter = require('../utils/dbAdapter');

// 爬取日志存储
const crawlLogs = new Map();
const MAX_LOG_ENTRIES = 500;

// 实时日志存储
const realtimeLogs = [];
const MAX_REALTIME_LOGS = 1000;

// 重写console.log和console.error以捕获日志
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function addRealtimeLog(level, ...args) {
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
    
    realtimeLogs.push({
        time: new Date().toISOString(),
        level,
        message
    });
    
    if (realtimeLogs.length > MAX_REALTIME_LOGS) {
        realtimeLogs.shift();
    }
}

console.log = function(...args) {
    addRealtimeLog('info', ...args);
    originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
    addRealtimeLog('error', ...args);
    originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
    addRealtimeLog('warn', ...args);
    originalConsoleWarn.apply(console, args);
};

function addCrawlLog(taskId, message, type = 'info') {
    if (!crawlLogs.has(taskId)) {
        crawlLogs.set(taskId, []);
    }
    const logs = crawlLogs.get(taskId);
    logs.push({
        time: new Date().toISOString(),
        message,
        type
    });
    if (logs.length > MAX_LOG_ENTRIES) {
        logs.shift();
    }
}

function getCrawlLogs(taskId) {
    return crawlLogs.get(taskId) || [];
}

function clearCrawlLogs(taskId) {
    crawlLogs.delete(taskId);
}

// ==================== 辅助函数 ====================

/**
 * 获取统计数据
 */
async function getStats(req, res) {
    try {
        const userCount = await DbAdapter.count(User, {});
        const workCount = await DbAdapter.count(Work, {});
        const commentCount = await DbAdapter.count(Comment, {});
        const todayUsers = await DbAdapter.count(User, {
            where: {
                created_at: {
                    [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });
        const todayWorks = await DbAdapter.count(Work, {
            where: {
                created_at: {
                    [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });
        const todayComments = await DbAdapter.count(Comment, {
            where: {
                created_at: {
                    [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });
        const pendingReports = await DbAdapter.count(Report, { where: { status: 'pending' } });
        const activeIpBans = await DbAdapter.count(IpBan, { where: {} });
        const featuredWorks = await DbAdapter.count(Work, { where: { is_featured: true } });
        const disabledUsers = await DbAdapter.count(User, { where: { status: 'disabled' } });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const newUsersWeek = await DbAdapter.count(User, {
            where: { created_at: { [Op.gte]: sevenDaysAgo } }
        });
        const newWorksWeek = await DbAdapter.count(Work, {
            where: { created_at: { [Op.gte]: sevenDaysAgo } }
        });

        return successResponse(res, {
            userCount,
            workCount,
            commentCount,
            todayUsers,
            todayWorks,
            todayComments,
            pendingReports,
            activeIpBans,
            featuredWorks,
            disabledUsers,
            newUsersWeek,
            newWorksWeek
        });
    } catch (error) {
        console.error('获取统计错误:', error);
        return errorResponse(res, '获取统计数据失败', 500);
    }
}

/**
 * 获取用户列表
 */
async function getUsers(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const keyword = req.query.keyword || '';
        const role = req.query.role || '';
        const status = req.query.status || '';

        const where = {};
        
        if (keyword) {
            where[Op.or] = [
                { username: { [Op.like]: `%${keyword}%` } },
                { nickname: { [Op.like]: `%${keyword}%` } },
                { email: { [Op.like]: `%${keyword}%` } },
                { codemao_user_id: { [Op.like]: `%${keyword}%` } }
            ];
        }
        
        if (role) where.role = role;
        if (status) where.status = status;

        const { count, rows } = await DbAdapter.findAndCountAll(User, {
            where,
            attributes: { exclude: ['password'] },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取用户列表错误:', error);
        return errorResponse(res, '获取用户列表失败', 500);
    }
}

/**
 * 获取用户详情
 */
async function getUserDetail(req, res) {
    try {
        const { userId } = req.params;
        
        const user = await DbAdapter.findByPk(User, userId, {
            attributes: { exclude: ['password'] }
        });
        
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        const [works, comments, favorites, following, followers] = await Promise.all([
            DbAdapter.findAndCountAll(Work, {
                where: { user_id: userId },
                order: [['created_at', 'DESC']],
                limit: 10
            }),
            DbAdapter.findAndCountAll(Comment, {
                where: { user_id: userId },
                include: [{
                    model: Work,
                    as: 'work',
                    attributes: ['id', 'name', 'codemao_work_id']
                }],
                order: [['created_at', 'DESC']],
                limit: 10
            }),
            DbAdapter.count(Favorite, { where: { user_id: userId } }),
            DbAdapter.count(Follow, { where: { follower_id: userId } }),
            DbAdapter.count(Follow, { where: { following_id: userId } })
        ]);
        
        const likesReceived = await DbAdapter.count(Favorite, {
            include: [{
                model: Work,
                as: 'work',
                where: { user_id: userId },
                attributes: []
            }]
        });
        
        const stats = {
            worksCount: works.count,
            commentsCount: comments.count,
            favoritesCount: favorites,
            followingCount: following,
            followersCount: followers,
            likesReceived: likesReceived
        };
        
        logOperation(req, 'view_user_detail', 'user', userId, { username: user.username });
        
        return successResponse(res, {
            user,
            stats,
            recentWorks: works.rows,
            recentComments: comments.rows
        });
    } catch (error) {
        console.error('获取用户详情错误:', error);
        return errorResponse(res, '获取用户详情失败', 500);
    }
}

/**
 * 修改用户密码
 */
async function updateUserPassword(req, res) {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return errorResponse(res, '密码长度至少6位', 400);
        }
        
        const user = await DbAdapter.findByPk(User, userId);
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await DbAdapter.update(User, { password: hashedPassword }, { where: { id: userId } });
        
        logOperation(req, 'update_user_password', 'user', userId);
        return successResponse(res, null, '密码已更新');
    } catch (error) {
        console.error('修改用户密码错误:', error);
        return errorResponse(res, '修改密码失败', 500);
    }
}

/**
 * 更新用户信息
 */
async function updateUser(req, res) {
    try {
        const { userId } = req.params;
        const { nickname, email, role, status, is_active_dalao } = req.body;
        const operatorRole = req.user.role;

        const user = await DbAdapter.findByPk(User, userId);
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }

        // 检查权限
        if (role && role !== user.role) {
            if (!canManageUser(operatorRole, user.role) || !canManageUser(operatorRole, role)) {
                return errorResponse(res, '权限不足', 403);
            }
        }

        const updateData = {};
        if (nickname !== undefined) updateData.nickname = nickname;
        if (email !== undefined) updateData.email = email;
        if (role !== undefined) updateData.role = role;
        if (status !== undefined) updateData.status = status;
        if (is_active_dalao !== undefined) updateData.is_active_dalao = is_active_dalao;

        await DbAdapter.update(User, updateData, { where: { id: userId } });
        logOperation(req, 'update_user', 'user', userId, { 
            changes: updateData,
            old_values: {
                nickname: user.nickname,
                email: user.email,
                role: user.role,
                status: user.status,
                is_active_dalao: user.is_active_dalao
            }
        });

        return successResponse(res, null, '更新成功');
    } catch (error) {
        console.error('更新用户信息错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

/**
 * 一键登录用户
 */
async function impersonateUser(req, res) {
    try {
        const { userId } = req.params;
        const operatorRole = req.user.role;

        if (operatorRole !== 'admin' && operatorRole !== 'superadmin') {
            return errorResponse(res, '权限不足', 403);
        }

        const user = await DbAdapter.findByPk(User, userId);
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }

        // 生成 Token
        const token = jwt.sign(
            { id: DbAdapter.getId(user), username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        logOperation(req, 'impersonate_user', 'user', userId);

        return successResponse(res, {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                nickname: user.nickname,
                avatar: user.avatar,
                role: user.role
            }
        }, '登录成功');
    } catch (error) {
        console.error('一键登录错误:', error);
        return errorResponse(res, '操作失败', 500);
    }
}

/**
 * 更新用户状态
 */
async function updateUserStatus(req, res) {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        const user = await DbAdapter.findByPk(User, userId);
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }

        await DbAdapter.update(User, { status }, { where: { id: userId } });
        
        logOperation(req, 'update_user_status', 'user', userId, { 
            username: user.username, 
            oldStatus: user.status, 
            newStatus: status 
        });

        return successResponse(res, null, '更新成功');
    } catch (error) {
        console.error('更新用户状态错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

/**
 * 更新用户角色
 */
async function updateUserRole(req, res) {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        const operatorRole = req.user.role;

        if (!['user', 'reviewer', 'moderator', 'admin', 'superadmin'].includes(role)) {
            return errorResponse(res, '无效的角色', 400);
        }

        const targetUser = await DbAdapter.findByPk(User, userId);
        if (!targetUser) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        // 检查操作者是否有权限管理目标用户
        if (!canManageUser(operatorRole, targetUser.role)) {
            return errorResponse(res, '您没有权限管理此用户', 403);
        }
        
        // 检查操作者是否有权限分配目标角色
        const targetRoleInfo = getRole(role);
        const operatorRoleInfo = getRole(operatorRole);
        if (targetRoleInfo.level >= operatorRoleInfo.level) {
            return errorResponse(res, '您没有权限分配此角色', 403);
        }

        const oldRole = targetUser.role;
        await DbAdapter.update(User, { role }, { where: { id: userId } });
        
        logOperation(req, 'update_user_role', 'user', userId, { 
            username: targetUser.username, 
            oldRole, 
            newRole: role 
        });
        
        await DbAdapter.create(Notification, {
            user_id: targetUser.id,
            type: 'system',
            title: '角色变更通知',
            content: `您的角色已从「${getRole(oldRole).name}」变更为「${getRole(role).name}」`
        });

        return successResponse(res, { role }, '更新成功');
    } catch (error) {
        console.error('更新用户角色错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

/**
 * 删除用户
 */
async function deleteUser(req, res) {
    try {
        const { userId } = req.params;

        const user = await DbAdapter.findByPk(User, userId);
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }

        if (DbAdapter.getId(user) === DbAdapter.getId(req.user)) {
            return errorResponse(res, '不能删除自己', 400);
        }

        await DbAdapter.destroy(User, { where: { id: DbAdapter.getId(user) } });
        logOperation(req, 'delete_user', 'user', userId, { username: user.username });

        return successResponse(res, null, '删除成功');
    } catch (error) {
        console.error('删除用户错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

/**
 * 获取作品列表（管理）
 */
async function getWorks(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const keyword = req.query.keyword || '';
        const status = req.query.status || '';
        const isFeatured = req.query.isFeatured || '';
        const type = req.query.type || '';

        const where = {};
        
        if (keyword) {
            where[Op.or] = [
                { name: { [Op.like]: `%${keyword}%` } },
                { codemao_work_id: { [Op.like]: `%${keyword}%` } },
                { codemao_author_name: { [Op.like]: `%${keyword}%` } }
            ];
        }
        
        if (status) where.status = status;
        if (isFeatured !== '') where.is_featured = isFeatured === 'true';
        if (type) where.type = type;

        const { count, rows } = await DbAdapter.findAndCountAll(Work, {
            where,
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取作品列表错误:', error);
        return errorResponse(res, '获取作品列表失败', 500);
    }
}

/**
 * 更新作品信息
 */
async function updateWork(req, res) {
    try {
        const { workId } = req.params;
        const { name, view_times, praise_times, collection_times, status, is_featured } = req.body;

        const work = await DbAdapter.findByPk(Work, workId);
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (view_times !== undefined) updateData.view_times = view_times;
        if (praise_times !== undefined) updateData.praise_times = praise_times;
        if (collection_times !== undefined) updateData.collection_times = collection_times;
        if (status !== undefined) updateData.status = status;
        if (is_featured !== undefined) updateData.is_featured = is_featured;

        await DbAdapter.update(Work, updateData, { where: { id: workId } });
        logOperation(req, 'update_work', 'work', workId, { 
            name: work.name,
            changes: updateData,
            old_values: {
                name: work.name,
                view_times: work.view_times,
                praise_times: work.praise_times,
                collection_times: work.collection_times,
                status: work.status,
                is_featured: work.is_featured
            }
        });

        return successResponse(res, null, '更新成功');
    } catch (error) {
        console.error('更新作品错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

/**
 * 设置作品精选
 */
async function setWorkFeatured(req, res) {
    try {
        const { workId } = req.params;
        const { isFeatured } = req.body;

        const work = await DbAdapter.findByPk(Work, workId);
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }

        await DbAdapter.update(Work, { is_featured: isFeatured }, { where: { id: workId } });
        logOperation(req, 'set_work_featured', 'work', workId, { isFeatured });

        return successResponse(res, null, isFeatured ? '已设为精选' : '已取消精选');
    } catch (error) {
        console.error('设置精选错误:', error);
        return errorResponse(res, '操作失败', 500);
    }
}

/**
 * 删除作品
 */
async function deleteWork(req, res) {
    try {
        const { workId } = req.params;

        const work = await DbAdapter.findByPk(Work, workId);
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }

        await DbAdapter.destroy(Work, { where: { id: DbAdapter.getId(work) } });
        logOperation(req, 'delete_work', 'work', workId, { name: work.name });

        return successResponse(res, null, '删除成功');
    } catch (error) {
        console.error('删除作品错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

/**
 * 爬取作品
 */
async function crawlWork(req, res) {
    try {
        const { workId } = req.body;

        if (!workId) {
            return errorResponse(res, '请提供作品ID', 400);
        }

        const workDetail = await codemaoApi.getWorkDetail(workId);
        if (!workDetail || !workDetail.id) {
            return errorResponse(res, '获取作品信息失败，请检查作品ID', 400);
        }

        const existing = await DbAdapter.findOne(Work, { where: { codemao_work_id: workDetail.id } });
        if (existing) {
            return errorResponse(res, '作品已存在', 400);
        }

        let user = await DbAdapter.findOne(User, { 
            where: { codemao_user_id: workDetail.user_info?.id } 
        });

        if (!user) {
            user = await DbAdapter.create(User, {
                codemao_user_id: workDetail.user_info.id,
                username: `codemao_${workDetail.user_info.id}`,
                email: `codemao_${workDetail.user_info.id}@placeholder.com`,
                password: '$2a$10$placeholder',
                nickname: workDetail.user_info.nickname,
                avatar: workDetail.user_info.avatar,
                bio: workDetail.user_info.description,
                role: 'user',
                status: 'active'
            });
        }

        // 识别作品类型 (主类型)
        const workType = workDetail.type || 'KITTEN';
        
        const work = await DbAdapter.create(Work, {
            codemao_work_id: workDetail.id,
            name: workDetail.work_name,
            description: workDetail.description,
            preview: workDetail.preview,
            type: workType,
            work_url: workDetail.player_url,
            user_id: DbAdapter.getId(user),
            codemao_author_id: workDetail.user_info.id,
            codemao_author_name: workDetail.user_info.nickname,
            view_times: workDetail.view_times || 0,
            praise_times: workDetail.liked_times || 0,
            collection_times: workDetail.collect_times || 0,
            comment_count: workDetail.comment_times || 0,
            status: 'published'
        });

        return successResponse(res, work, '爬取成功');
    } catch (error) {
        console.error('爬取作品错误:', error);
        return errorResponse(res, '爬取失败', 500);
    }
}

/**
 * 批量爬取发现页面作品 - 使用新的API
 */
async function crawlHotWorks(req, res) {
    const taskId = Date.now().toString();
    try {
        const { count = 20 } = req.body;
        const targetCount = Math.max(count, 1);
        const results = [];
        let offset = 0;
        const pageSize = 50;
        let attempts = 0;
        const maxAttempts = Math.ceil(targetCount * 3) + 100;
        let skippedCount = 0;
        let errorCount = 0;
        const seenWorkIds = new Set();

        addCrawlLog(taskId, `开始爬取发现页面作品，目标数量: ${targetCount}`, 'start');
        console.log(`开始爬取发现页面作品，目标数量: ${targetCount}...`);

        while (results.length < targetCount && attempts < maxAttempts) {
            attempts++;
            const statusMsg = `第 ${attempts} 次 | 成功: ${results.length}/${targetCount} | 跳过: ${skippedCount} | 错误: ${errorCount}`;
            addCrawlLog(taskId, statusMsg);
            console.log(statusMsg);

            const discoverData = await codemaoApi.getDiscoverWorks(offset, pageSize);
            
            if (!discoverData || !discoverData.items || discoverData.items.length === 0) {
                addCrawlLog(taskId, 'API返回为空，重新从开头获取', 'warn');
                offset = 0;
                attempts++;
                if (attempts >= maxAttempts) break;
                continue;
            }

            let pageAdded = 0;
            let pageSkipped = 0;

            for (const item of discoverData.items) {
                if (results.length >= targetCount) break;
                
                try {
                    const workId = item.work_id;
                    if (!workId) {
                        pageSkipped++;
                        continue;
                    }

                    if (seenWorkIds.has(workId)) {
                        pageSkipped++;
                        continue;
                    }
                    seenWorkIds.add(workId);
                    
                    const existing = await DbAdapter.findOne(Work, { where: { codemao_work_id: String(workId) } });
                    if (existing) {
                        pageSkipped++;
                        skippedCount++;
                        continue;
                    }

                    let user = await DbAdapter.findOne(User, { 
                        where: { codemao_user_id: String(item.user_id) } 
                    });

                    if (!user) {
                        try {
                            user = await DbAdapter.create(User, {
                                codemao_user_id: String(item.user_id),
                                username: `codemao_${item.user_id}`,
                                email: `codemao_${item.user_id}@placeholder.com`,
                                password: '$2a$10$placeholder',
                                nickname: item.nickname || `用户${item.user_id}`,
                                avatar: item.avatar_url,
                                role: 'user',
                                status: 'active'
                            });
                        } catch (userCreateError) {
                            user = await DbAdapter.findOne(User, { 
                                where: { codemao_user_id: String(item.user_id) } 
                            });
                            if (!user) {
                                pageSkipped++;
                                continue;
                            }
                        }
                    }

                    const workDetail = await codemaoApi.getWorkDetail(workId);
                    if (!workDetail || !workDetail.id || !workDetail.work_name) {
                        pageSkipped++;
                        errorCount++;
                        continue;
                    }

                    try {
                        const work = await DbAdapter.create(Work, {
                            codemao_work_id: String(workId),
                            name: workDetail.work_name || item.work_name || `作品${workId}`,
                            description: workDetail.description || '',
                            preview: workDetail.preview || item.preview_url || '',
                            type: workDetail.type || workDetail.work_label_list?.[0]?.label_name || 'KITTEN',
                            ide_type: workDetail.ide_type || 'KITTEN',
                            work_url: workDetail.player_url || `https://player.codemao.cn/new/${workId}`,
                            user_id: DbAdapter.getId(user),
                            codemao_author_id: String(item.user_id),
                            codemao_author_name: item.nickname || workDetail.user_info?.nickname || '未知',
                            view_times: workDetail.view_times || item.views_count || 0,
                            praise_times: workDetail.liked_times || workDetail.praise_times || item.likes_count || 0,
                            collection_times: workDetail.collect_times || 0,
                            comment_count: workDetail.comment_times || 0,
                            status: 'published'
                        });

                        results.push(work);
                        pageAdded++;
                        const successMsg = `✅ 成功 (${results.length}/${targetCount}): ${work.name}`;
                        addCrawlLog(taskId, successMsg, 'success');
                        console.log(successMsg);
                    } catch (createError) {
                        if (createError.name === 'SequelizeUniqueConstraintError') {
                            pageSkipped++;
                            skippedCount++;
                        } else {
                            pageSkipped++;
                            errorCount++;
                            addCrawlLog(taskId, `创建失败: ${createError.message}`, 'error');
                        }
                    }
                } catch (e) {
                    pageSkipped++;
                    errorCount++;
                    addCrawlLog(taskId, `处理失败: ${e.message}`, 'error');
                }
            }

            addCrawlLog(taskId, `本页: 成功 ${pageAdded}，跳过 ${pageSkipped}`);
            
            offset += pageSize;
            
            if (discoverData.items.length < pageSize) {
                addCrawlLog(taskId, '已到最后一页，重新从开头获取', 'warn');
                offset = 0;
            }
        }

        const completeMsg = `爬取完成！成功: ${results.length}，跳过: ${skippedCount}，错误: ${errorCount}`;
        addCrawlLog(taskId, completeMsg, 'complete');
        console.log(completeMsg);
        
        return successResponse(res, { 
            taskId,
            total: results.length,
            skipped: skippedCount,
            errors: errorCount,
            attempts,
            works: results.map(w => ({ id: w.id, name: w.name, codemao_work_id: w.codemao_work_id }))
        }, `成功爬取 ${results.length} 个作品`);
    } catch (error) {
        addCrawlLog(taskId, `爬取失败: ${error.message}`, 'error');
        console.error('批量爬取错误:', error);
        return errorResponse(res, '批量爬取失败: ' + error.message, 500);
    }
}

/**
 * 获取爬取日志
 */
async function getCrawlLogs(req, res) {
    try {
        const { taskId } = req.query;
        const logs = crawlLogs.get(taskId) || [];
        return successResponse(res, { logs });
    } catch (error) {
        return errorResponse(res, '获取日志失败', 500);
    }
}

/**
 * 获取实时日志
 */
async function getRealtimeLogs(req, res) {
    try {
        const { lastTime, limit = 100 } = req.query;
        let logs = realtimeLogs;
        
        if (lastTime) {
            const lastTimeDate = new Date(lastTime);
            logs = logs.filter(log => new Date(log.time) > lastTimeDate);
        }
        
        if (limit) {
            logs = logs.slice(-parseInt(limit));
        }
        
        return successResponse(res, { 
            logs,
            total: realtimeLogs.length
        });
    } catch (error) {
        return errorResponse(res, '获取日志失败', 500);
    }
}

/**
 * 清空实时日志
 */
async function clearRealtimeLogs(req, res) {
    try {
        realtimeLogs.length = 0;
        return successResponse(res, { message: '日志已清空' });
    } catch (error) {
        return errorResponse(res, '清空日志失败', 500);
    }
}

/**
 * 按用户ID爬取作品
 */
async function crawlUserWorks(req, res) {
    try {
        const { userId, limit = 100 } = req.body;
        
        if (!userId) {
            return errorResponse(res, '请提供用户ID', 400);
        }
        
        console.log(`开始爬取用户 ${userId} 的作品...`);
        
        const worksData = await codemaoApi.getUserWorks(userId, 0, Math.min(limit, 100));
        
        if (!worksData || !worksData.items || worksData.items.length === 0) {
            return errorResponse(res, '该用户没有公开作品', 400);
        }
        
        let user = await DbAdapter.findOne(User, { where: { codemao_user_id: String(userId) } });
        if (!user) {
            user = await DbAdapter.findOne(User, { where: { username: `codemao_${userId}` } });
        }
        if (!user) {
            const userInfo = await codemaoApi.getUserInfo(userId);
            try {
                user = await DbAdapter.create(User, {
                    codemao_user_id: String(userId),
                    username: `codemao_${userId}`,
                    email: `codemao_${userId}@placeholder.com`,
                    password: '$2a$10$placeholder',
                    nickname: userInfo?.nickname || userInfo?.username || `用户${userId}`,
                    avatar: userInfo?.avatar_url,
                    bio: userInfo?.description,
                    role: 'user',
                    status: 'active'
                });
            } catch (createError) {
                console.error('创建用户失败:', createError.message);
                user = await DbAdapter.findOne(User, { where: { username: `codemao_${userId}` } });
            }
        }
        
        const results = [];
        
        for (const item of worksData.items) {
            try {
                const existing = await DbAdapter.findOne(Work, { where: { codemao_work_id: item.id } });
                if (existing) continue;
                
                const workDetail = await codemaoApi.getWorkDetail(item.id);
                if (!workDetail || !workDetail.id) continue;
                
                console.log('爬取作品详情:', {
                    id: workDetail.id,
                    name: workDetail.work_name,
                    preview: workDetail.preview,
                    player_url: workDetail.player_url,
                    ide_type: workDetail.ide_type,
                    type: workDetail.type
                });
                
                const workType = workDetail.type || 'KITTEN';
                
                const work = await DbAdapter.create(Work, {
                    codemao_work_id: String(workDetail.id),
                    name: workDetail.work_name,
                    description: workDetail.description,
                    preview: workDetail.preview,
                    type: workType,
                    work_url: workDetail.player_url,
                    user_id: DbAdapter.getId(user),
                    codemao_author_id: String(userId),
                    codemao_author_name: workDetail.user_info?.nickname,
                    view_times: workDetail.view_times || 0,
                    praise_times: workDetail.liked_times || workDetail.praise_times || 0,
                    collection_times: workDetail.collect_times || 0,
                    comment_count: workDetail.comment_times || 0,
                    status: 'published'
                });
                
                console.log('作品创建成功:', work.name, 'preview:', work.preview);
                results.push(work);
            } catch (e) {
                console.error(`爬取作品 ${item.id} 失败:`, e.message);
            }
        }
        
        await DbAdapter.update(User, { work_count: results.length }, { where: { id: DbAdapter.getId(user) } });
        
        return successResponse(res, { total: results.length }, `成功爬取 ${results.length} 个作品`);
    } catch (error) {
        console.error('爬取用户作品错误:', error);
        return errorResponse(res, '爬取失败', 500);
    }
}

/**
 * 从论坛帖子爬取作品
 */
async function crawlPostWorks(req, res) {
    try {
        const { keyword, limit = 20 } = req.body;
        
        console.log(`开始从帖子搜索 "${keyword}" 爬取作品...`);
        
        const postsData = await codemaoApi.searchPosts(keyword, 1, 50);
        
        if (!postsData || !postsData.items) {
            return errorResponse(res, '搜索帖子失败', 400);
        }
        
        const workIds = new Set();
        const results = [];
        
        for (const post of postsData.items) {
            const matches = post.content?.matchAll(/work\/(\d+)/g);
            if (matches) {
                for (const match of matches) {
                    workIds.add(parseInt(match[1]));
                }
            }
        }
        
        console.log(`从帖子中提取到 ${workIds.size} 个作品ID`);
        
        for (const workId of Array.from(workIds).slice(0, limit)) {
            try {
                const existing = await DbAdapter.findOne(Work, { where: { codemao_work_id: workId } });
                if (existing) continue;
                
                const workDetail = await codemaoApi.getWorkDetail(workId);
                if (!workDetail || !workDetail.id) continue;
                
                const authorId = String(workDetail.user_info?.id);
                let user = await DbAdapter.findOne(User, { where: { codemao_user_id: authorId } });
                if (!user) {
                    user = await DbAdapter.findOne(User, { where: { username: `codemao_${authorId}` } });
                }
                if (!user) {
                    try {
                        user = await DbAdapter.create(User, {
                            codemao_user_id: authorId,
                            username: `codemao_${authorId}`,
                            email: `codemao_${authorId}@placeholder.com`,
                            password: '$2a$10$placeholder',
                            nickname: workDetail.user_info?.nickname || `用户${authorId}`,
                            avatar: workDetail.user_info?.avatar,
                            bio: workDetail.user_info?.description,
                            role: 'user',
                            status: 'active'
                        });
                    } catch (createError) {
                        console.error('创建用户失败:', createError.message);
                        user = await DbAdapter.findOne(User, { where: { username: `codemao_${authorId}` } });
                    }
                }
                
                const workType = workDetail.type || '其他';
                
                const work = await DbAdapter.create(Work, {
                    codemao_work_id: String(workDetail.id),
                    name: workDetail.work_name,
                    description: workDetail.description,
                    preview: workDetail.preview,
                    type: workType,
                    work_url: workDetail.player_url,
                    user_id: DbAdapter.getId(user),
                    codemao_author_id: String(workDetail.user_info?.id),
                    codemao_author_name: workDetail.user_info?.nickname,
                    view_times: workDetail.view_times || 0,
                    praise_times: workDetail.praise_times || workDetail.liked_times || 0,
                    collection_times: workDetail.collect_times || 0,
                    comment_count: workDetail.comment_times || 0,
                    status: 'published'
                });
                
                results.push(work);
            } catch (e) {
                console.error(`爬取作品 ${workId} 失败:`, e.message);
            }
        }
        
        return successResponse(res, { total: results.length }, `成功爬取 ${results.length} 个作品`);
    } catch (error) {
        console.error('从帖子爬取作品错误:', error);
        return errorResponse(res, '爬取失败', 500);
    }
}

async function crawlBanners(req, res) {
    try {
        console.log('开始从编程猫爬取轮播图...');
        
        const bannerData = await codemaoApi.getBanners();
        console.log('API返回数据:', JSON.stringify(bannerData, null, 2));
        
        if (!bannerData) {
            return errorResponse(res, '获取轮播图数据为空', 500);
        }
        
        let items = bannerData.items || bannerData.data || bannerData.banners || bannerData;
        if (!Array.isArray(items)) {
            console.log('数据格式:', typeof items, Object.keys(bannerData));
            return errorResponse(res, '轮播图数据格式不正确', 500);
        }
        
        if (items.length === 0) {
            return errorResponse(res, '没有找到轮播图', 404);
        }
        
        await DbAdapter.destroy(Banner, { where: {} });
        
        let count = 0;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`处理轮播图 ${i + 1}:`, item);
            try {
                await DbAdapter.create(Banner, {
                    title: item.title || item.name || item.text || `轮播图${i + 1}`,
                    image_url: item.background_url || item.image_url || item.cover || item.picture || item.image || item.src,
                    link_url: item.target_url || item.link_url || item.url || item.link || '',
                    sort: i,
                    is_active: true
                });
                count++;
            } catch (e) {
                console.error('创建轮播图失败:', e.message);
            }
        }
        
        logOperation(req, 'crawl_banners', 'banner', null, { count });
        console.log(`爬取轮播图完成，共 ${count} 个`);
        return successResponse(res, { count }, `成功爬取 ${count} 个轮播图`);
    } catch (error) {
        console.error('爬取轮播图错误:', error);
        return errorResponse(res, '爬取失败', 500);
    }
}

/**
 * 获取轮播图列表
 */
async function getBanners(req, res) {
    try {
        const banners = await DbAdapter.findAll(Banner, {
            order: [['sort', 'ASC'], ['created_at', 'DESC']]
        });
        return successResponse(res, banners);
    } catch (error) {
        console.error('获取轮播图错误:', error);
        return errorResponse(res, '获取轮播图失败', 500);
    }
}

/**
 * 创建轮播图
 */
async function createBanner(req, res) {
    try {
        const { title, image_url, link_url, sort, is_active } = req.body;
        
        if (!image_url) {
            return errorResponse(res, '请提供图片URL', 400);
        }
        
        const banner = await DbAdapter.create(Banner, {
            title,
            image_url,
            link_url,
            sort: sort || 0,
            is_active: is_active !== false
        });
        
        logOperation(req, 'create_banner', 'banner', DbAdapter.getId(banner), { title, image_url });
        
        return successResponse(res, banner, '创建成功');
    } catch (error) {
        console.error('创建轮播图错误:', error);
        return errorResponse(res, '创建失败', 500);
    }
}

/**
 * 更新轮播图
 */
async function updateBanner(req, res) {
    try {
        const { bannerId } = req.params;
        const { title, image_url, link_url, sort_order, status } = req.body;
        
        const banner = await DbAdapter.findByPk(Banner, bannerId);
        if (!banner) {
            return errorResponse(res, '轮播图不存在', 404);
        }
        
        await DbAdapter.update(Banner, {
            title,
            image_url,
            link_url,
            sort_order,
            status
        }, { where: { id: bannerId } });
        
        logOperation(req, 'update_banner', 'banner', bannerId, { title, image_url, link_url });
        
        return successResponse(res, banner, '更新成功');
    } catch (error) {
        console.error('更新轮播图错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

/**
 * 删除轮播图
 */
async function deleteBanner(req, res) {
    try {
        const { bannerId } = req.params;
        
        const banner = await DbAdapter.findByPk(Banner, bannerId);
        if (!banner) {
            return errorResponse(res, '轮播图不存在', 404);
        }
        
        await DbAdapter.destroy(Banner, { where: { id: DbAdapter.getId(banner) } });
        logOperation(req, 'delete_banner', 'banner', bannerId, { title: banner.title });
        
        return successResponse(res, null, '删除成功');
    } catch (error) {
        console.error('删除轮播图错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

/**
 * 获取评论列表
 */
async function getComments(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const keyword = req.query.keyword || '';
        const status = req.query.status || '';
        const userId = req.query.userId || '';
        const workId = req.query.workId || '';

        const where = {};
        
        if (keyword) {
            where.content = { [Op.like]: `%${keyword}%` };
        }
        if (status) where.status = status;
        if (userId) where.user_id = userId;
        if (workId) where.work_id = workId;

        const { count, rows } = await DbAdapter.findAndCountAll(Comment, {
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'nickname', 'avatar']
                },
                {
                    model: Work,
                    as: 'work',
                    attributes: ['id', 'name', 'preview'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取评论列表错误:', error);
        return errorResponse(res, '获取评论列表失败', 500);
    }
}

/**
 * 更新评论状态
 */
async function updateCommentStatus(req, res) {
    try {
        const { commentId } = req.params;
        const { status } = req.body;

        const comment = await DbAdapter.findByPk(Comment, commentId);
        if (!comment) {
            return errorResponse(res, '评论不存在', 404);
        }

        await DbAdapter.update(Comment, { status }, { where: { id: commentId } });
        logOperation(req, 'update_comment_status', 'comment', commentId, { status });

        return successResponse(res, null, '更新成功');
    } catch (error) {
        console.error('更新评论状态错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

/**
 * 删除评论
 */
async function deleteComment(req, res) {
    try {
        const { commentId } = req.params;

        const comment = await DbAdapter.findByPk(Comment, commentId);
        if (!comment) {
            return errorResponse(res, '评论不存在', 404);
        }

        await DbAdapter.update(Comment, { status: 'deleted' }, { where: { id: commentId } });
        logOperation(req, 'delete_comment', 'comment', commentId, { 
            content: comment.content.substring(0, 100),
            user_id: comment.user_id 
        });

        return successResponse(res, null, '删除成功');
    } catch (error) {
        console.error('删除评论错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

/**
 * 获取举报列表
 */
async function getReports(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const type = req.query.type || '';
        const status = req.query.status || '';

        const where = {};
        if (type) where.type = type;
        if (status) where.status = status;

        const { count, rows } = await DbAdapter.findAndCountAll(Report, {
            where,
            include: [
                {
                    model: User,
                    as: 'reporter',
                    attributes: ['id', 'username', 'nickname', 'avatar']
                },
                {
                    model: User,
                    as: 'handler',
                    attributes: ['id', 'username', 'nickname'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        for (const report of rows) {
            if (report.type === 'work') {
                report.dataValues.target = await DbAdapter.findByPk(Work, report.target_id, {
                    attributes: ['id', 'name', 'preview']
                });
            } else if (report.type === 'comment') {
                report.dataValues.target = await DbAdapter.findByPk(Comment, report.target_id);
            } else if (report.type === 'user') {
                report.dataValues.target = await DbAdapter.findByPk(User, report.target_id, {
                    attributes: ['id', 'username', 'nickname', 'avatar']
                });
            }
        }

        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取举报列表错误:', error);
        return errorResponse(res, '获取举报列表失败', 500);
    }
}

/**
 * 处理举报
 */
async function handleReport(req, res) {
    try {
        const { reportId } = req.params;
        const { status, handleNote, takeAction } = req.body;

        const report = await DbAdapter.findByPk(Report, reportId);
        if (!report) {
            return errorResponse(res, '举报不存在', 404);
        }

        await DbAdapter.update(Report, {
            status,
            handle_note: handleNote,
            handler_id: DbAdapter.getId(req.user)
        }, { where: { id: reportId } });
        logOperation(req, 'handle_report', 'report', reportId, { status, handleNote, takeAction });

        let targetOwnerId = null;
        const typeNames = { work: '作品', comment: '评论', post: '帖子', user: '用户' };

        if (takeAction && status === 'resolved') {
            if (report.type === 'work') {
                const work = await DbAdapter.findByPk(Work, report.target_id);
                if (work) {
                    targetOwnerId = work.user_id;
                    await DbAdapter.update(Work, { status: 'deleted' }, { where: { id: report.target_id } });
                }
            } else if (report.type === 'comment') {
                const comment = await DbAdapter.findByPk(Comment, report.target_id);
                if (comment) {
                    targetOwnerId = comment.user_id;
                    await DbAdapter.update(Comment, { status: 'deleted' }, { where: { id: report.target_id } });
                }
            } else if (report.type === 'post') {
                const post = await DbAdapter.findByPk(Post, report.target_id);
                if (post) {
                    targetOwnerId = post.user_id;
                    await DbAdapter.update(Post, { status: 'deleted' }, { where: { id: report.target_id } });
                }
            } else if (report.type === 'user') {
                targetOwnerId = report.target_id;
                await DbAdapter.update(User, { status: 'disabled' }, { where: { id: report.target_id } });
            }
        }

        let targetName = '';
        let linkType = report.type;
        let linkId = report.target_id;

        const target = await (async () => {
            if (report.type === 'work') return await DbAdapter.findByPk(Work, report.target_id);
            if (report.type === 'comment') return await DbAdapter.findByPk(Comment, report.target_id);
            if (report.type === 'post') return await DbAdapter.findByPk(Post, report.target_id);
            if (report.type === 'user') return await DbAdapter.findByPk(User, report.target_id);
            return null;
        })();

        if (target) {
            if (report.type === 'work') targetName = target.name;
            else if (report.type === 'post') targetName = target.title;
            else if (report.type === 'comment') {
                targetName = target.content.substring(0, 20) + (target.content.length > 20 ? '...' : '');
                if (target.work_id) { linkType = 'work'; linkId = target.work_id; }
                else if (target.post_id) { linkType = 'post'; linkId = target.post_id; }
            }
            else if (report.type === 'user') targetName = target.nickname || target.username;
        }

        // 发送举报处理结果通知给举报者
        const { Notification } = require('../models');
        const statusText = status === 'resolved' ? '已处理' : (status === 'rejected' ? '已驳回' : '处理中');
        await DbAdapter.create(Notification, {
            user_id: report.reporter_id,
            type: 'system',
            title: `举报${statusText}`,
            content: `您举报的${typeNames[report.type]}「${targetName}」已${statusText}。${handleNote ? '处理说明：' + handleNote : ''}`,
            related_id: linkId,
            related_type: linkType
        });

        // 如果采取了行动，通知被处理的用户
        if (takeAction && status === 'resolved' && targetOwnerId) {
            await DbAdapter.create(Notification, {
                user_id: targetOwnerId,
                type: 'system',
                title: `您的${typeNames[report.type]}已被处理`,
                content: `您的${typeNames[report.type]}「${targetName}」因违反社区规范已被处理。${handleNote ? '处理说明：' + handleNote : '如有疑问请联系管理员。'}`,
                related_id: linkId,
                related_type: linkType
            });
        }

        return successResponse(res, null, '处理成功');
    } catch (error) {
        console.error('处理举报错误:', error);
        return errorResponse(res, '处理失败', 500);
    }
}

/**
 * 获取IP封禁列表
 */
async function getIpBans(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status || '';

        const where = {};
        if (status) where.status = status;

        const { count, rows } = await DbAdapter.findAndCountAll(IpBan, {
            where,
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取IP封禁列表错误:', error);
        return errorResponse(res, '获取IP封禁列表失败', 500);
    }
}

/**
 * 添加IP封禁
 */
async function addIpBan(req, res) {
    try {
        const { ip_address, reason, expires_at } = req.body;

        if (!ip_address) {
            return errorResponse(res, '请提供IP地址', 400);
        }

        const existing = await DbAdapter.findOne(IpBan, { where: { ip: ip_address } });
        if (existing) {
            return errorResponse(res, '该IP已被封禁', 400);
        }

        const ipBan = await DbAdapter.create(IpBan, {
            ip: ip_address,
            reason,
            banned_by: DbAdapter.getId(req.user),
            expires_at: expires_at ? new Date(expires_at) : null
        });
        logOperation(req, 'add_ip_ban', 'ip_ban', DbAdapter.getId(ipBan), { ip: ip_address, reason });

        return successResponse(res, ipBan, '封禁成功');
    } catch (error) {
        console.error('添加IP封禁错误:', error);
        return errorResponse(res, '封禁失败', 500);
    }
}

/**
 * 解除IP封禁
 */
async function removeIpBan(req, res) {
    try {
        const { ipBanId } = req.params;

        const ipBan = await DbAdapter.findByPk(IpBan, ipBanId);
        if (!ipBan) {
            return errorResponse(res, '封禁记录不存在', 404);
        }

        await DbAdapter.destroy(IpBan, { where: { id: DbAdapter.getId(ipBan) } });
        logOperation(req, 'remove_ip_ban', 'ip_ban', ipBanId, { ip: ipBan.ip });

        return successResponse(res, null, '解除封禁成功');
    } catch (error) {
        console.error('解除IP封禁错误:', error);
        return errorResponse(res, '解除封禁失败', 500);
    }
}

/**
 * 获取数据趋势
 */
async function getTrends(req, res) {
    try {
        const days = parseInt(req.query.days) || 7;
        const result = {
            users: [],
            works: [],
            comments: [],
            dates: []
        };

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            result.dates.push(date.toISOString().split('T')[0]);
            result.users.push(await DbAdapter.count(User, {
                where: { created_at: { [Op.gte]: date, [Op.lt]: nextDate } }
            }));
            result.works.push(await DbAdapter.count(Work, {
                where: { created_at: { [Op.gte]: date, [Op.lt]: nextDate } }
            }));
            result.comments.push(await DbAdapter.count(Comment, {
                where: { created_at: { [Op.gte]: date, [Op.lt]: nextDate } }
            }));
        }

        return successResponse(res, result);
    } catch (error) {
        console.error('获取数据趋势错误:', error);
        return errorResponse(res, '获取数据趋势失败', 500);
    }
}

/**
 * 获取所有角色
 */
async function getRoles(req, res) {
    try {
        const roles = getAllRoles();
        return successResponse(res, roles);
    } catch (error) {
        console.error('获取角色错误:', error);
        return errorResponse(res, '获取角色失败', 500);
    }
}

/**
 * 获取管理员列表
 */
async function getAdminUsers(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const role = req.query.role;
        
        const where = {};
        if (role) {
            where.role = role;
        } else {
            where.role = { [Op.ne]: 'user' };
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(User, {
            where,
            attributes: ['id', 'username', 'nickname', 'avatar', 'role', 'status', 'created_at'],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取管理员列表错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

// ==================== 公告管理 ====================

async function getAnnouncements(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        
        const { count, rows } = await DbAdapter.findAndCountAll(Announcement, {
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取公告错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

async function createAnnouncement(req, res) {
    try {
        const { title, content, type } = req.body;
        
        const announcement = await DbAdapter.create(Announcement, {
            title,
            content,
            type: type || 'notice'
        });
        
        logOperation(req, 'create_announcement', 'announcement', DbAdapter.getId(announcement), { title });
        return successResponse(res, announcement, '创建成功');
    } catch (error) {
        console.error('创建公告错误:', error);
        return errorResponse(res, '创建失败', 500);
    }
}

async function updateAnnouncement(req, res) {
    try {
        const { announcementId } = req.params;
        const { title, content, type, is_active } = req.body;
        
        const announcement = await DbAdapter.findByPk(Announcement, announcementId);
        if (!announcement) {
            return errorResponse(res, '公告不存在', 404);
        }
        
        const updateData = { title, content, type };
        if (typeof is_active !== 'undefined') updateData.is_active = is_active;
        await DbAdapter.update(Announcement, updateData, { where: { id: announcementId } });
        logOperation(req, 'update_announcement', 'announcement', announcementId, { 
            title,
            changes: updateData
        });
        
        return successResponse(res, announcement, '更新成功');
    } catch (error) {
        console.error('更新公告错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

async function deleteAnnouncement(req, res) {
    try {
        const { announcementId } = req.params;
        
        const announcement = await DbAdapter.findByPk(Announcement, announcementId);
        if (!announcement) {
            return errorResponse(res, '公告不存在', 404);
        }
        
        await DbAdapter.destroy(Announcement, { where: { id: DbAdapter.getId(announcement) } });
        logOperation(req, 'delete_announcement', 'announcement', announcementId);
        
        return successResponse(res, null, '删除成功');
    } catch (error) {
        console.error('删除公告错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

// ==================== 系统设置 ====================

async function getSystemConfigs(req, res) {
    try {
        const configs = await DbAdapter.findAll(SystemConfig, {});
        const result = {};
        configs.forEach(c => { result[c.config_key] = c.config_value });
        return successResponse(res, result);
    } catch (error) {
        console.error('获取系统设置错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

async function updateSystemConfig(req, res) {
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        let config = await DbAdapter.findOne(SystemConfig, { where: { config_key: key } });
        if (config) {
            await DbAdapter.update(SystemConfig, { config_value: value }, { where: { config_key: key } });
        } else {
            config = await DbAdapter.create(SystemConfig, { config_key: key, config_value: value });
        }
        
        logOperation(req, 'update_config', 'system_config', null, { key, value });
        return successResponse(res, config, '更新成功');
    } catch (error) {
        console.error('更新系统设置错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

async function batchUpdateConfigs(req, res) {
    try {
        const { configs } = req.body;
        
        const hasDbConfig = Object.keys(configs).some(key => 
            key.startsWith('db_') || key.startsWith('mysql_')
        );
        
        if (hasDbConfig) {
            const fs = require('fs');
            const path = require('path');
            const envPath = path.join(__dirname, '../.env');
            
            let envContent = '';
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }
            
            if (configs.db_type) {
                envContent = updateEnvVariable(envContent, 'DB_TYPE', configs.db_type);
            }
            if (configs.mysql_host) {
                envContent = updateEnvVariable(envContent, 'DB_HOST', configs.mysql_host);
            }
            if (configs.mysql_port) {
                envContent = updateEnvVariable(envContent, 'DB_PORT', configs.mysql_port);
            }
            if (configs.mysql_database) {
                envContent = updateEnvVariable(envContent, 'DB_NAME', configs.mysql_database);
            }
            if (configs.mysql_username) {
                envContent = updateEnvVariable(envContent, 'DB_USER', configs.mysql_username);
            }
            if (configs.mysql_password) {
                envContent = updateEnvVariable(envContent, 'DB_PASSWORD', configs.mysql_password);
            }
            
            fs.writeFileSync(envPath, envContent);
        }
        
        for (const [key, value] of Object.entries(configs)) {
            const existing = await DbAdapter.findOne(SystemConfig, { where: { config_key: key } });
            if (existing) {
                await DbAdapter.update(SystemConfig, { config_value: value }, { where: { config_key: key } });
            } else {
                await DbAdapter.create(SystemConfig, { config_key: key, config_value: value });
            }
        }
        
        logOperation(req, 'batch_update_config', 'system_config', null, configs);
        
        if (hasDbConfig) {
            return successResponse(res, null, '数据库配置更新成功，请重启服务器以应用新配置');
        } else {
            return successResponse(res, null, '更新成功');
        }
    } catch (error) {
        console.error('批量更新系统设置错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

// 辅助函数：更新.env文件中的环境变量
function updateEnvVariable(content, key, value) {
    const regex = new RegExp(`^${key}=.*$`, 'gm');
    if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
    } else {
        return content + `\n${key}=${value}`;
    }
}

// ==================== 操作日志 ====================

async function getOperationLogs(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const userId = req.query.userId;
        const action = req.query.action;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        const where = {};
        if (userId) where.user_id = userId;
        if (action) where.action = { [Op.like]: `%${action}%` };
        if (startDate && endDate) {
            where.created_at = { [Op.between]: [new Date(startDate), new Date(endDate)] };
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(OperationLog, {
            where,
            include: [{ model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'role'] }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取操作日志错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

// ==================== 敏感词管理 ====================

async function getSensitiveWords(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const category = req.query.category;
        const status = req.query.status;
        
        const where = {};
        if (category) where.category = category;
        if (status) where.status = status;
        
        const { count, rows } = await DbAdapter.findAndCountAll(SensitiveWord, {
            where,
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取敏感词错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

async function addSensitiveWord(req, res) {
    try {
        const { word, category, level, replacement } = req.body;
        
        const existing = await DbAdapter.findOne(SensitiveWord, { where: { word } });
        if (existing) {
            return errorResponse(res, '该敏感词已存在', 400);
        }
        
        const sensitiveWord = await DbAdapter.create(SensitiveWord, {
            word,
            category: category || 'other',
            level: level || 'medium',
            replacement,
            created_by: DbAdapter.getId(req.user)
        });
        
        logOperation(req, 'add_sensitive_word', 'sensitive_word', DbAdapter.getId(sensitiveWord), { word });
        return successResponse(res, sensitiveWord, '添加成功');
    } catch (error) {
        console.error('添加敏感词错误:', error);
        return errorResponse(res, '添加失败', 500);
    }
}

async function updateSensitiveWord(req, res) {
    try {
        const { wordId } = req.params;
        const { word, category, level, replacement, status } = req.body;
        
        const sensitiveWord = await DbAdapter.findByPk(SensitiveWord, wordId);
        if (!sensitiveWord) {
            return errorResponse(res, '敏感词不存在', 404);
        }
        
        await DbAdapter.update(SensitiveWord, { word, category, level, replacement, status }, { where: { id: wordId } });
        logOperation(req, 'update_sensitive_word', 'sensitive_word', wordId, { word });
        
        return successResponse(res, sensitiveWord, '更新成功');
    } catch (error) {
        console.error('更新敏感词错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

async function deleteSensitiveWord(req, res) {
    try {
        const { wordId } = req.params;
        
        const sensitiveWord = await DbAdapter.findByPk(SensitiveWord, wordId);
        if (!sensitiveWord) {
            return errorResponse(res, '敏感词不存在', 404);
        }
        
        await DbAdapter.destroy(SensitiveWord, { where: { id: DbAdapter.getId(sensitiveWord) } });
        logOperation(req, 'delete_sensitive_word', 'sensitive_word', wordId);
        
        return successResponse(res, null, '删除成功');
    } catch (error) {
        console.error('删除敏感词错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

async function batchImportSensitiveWords(req, res) {
    try {
        const { words, category, level } = req.body;
        const results = { success: 0, failed: 0, duplicates: 0 };
        
        for (const word of words) {
            const existing = await DbAdapter.findOne(SensitiveWord, { where: { word } });
            if (existing) {
                results.duplicates++;
                continue;
            }
            
            try {
                await DbAdapter.create(SensitiveWord, {
                    word,
                    category: category || 'other',
                    level: level || 'medium',
                    created_by: DbAdapter.getId(req.user)
                });
                results.success++;
            } catch (e) {
                results.failed++;
            }
        }
        
        logOperation(req, 'batch_import_sensitive_words', 'sensitive_word', null, results);
        return successResponse(res, results, `成功导入${results.success}个敏感词`);
    } catch (error) {
        console.error('批量导入敏感词错误:', error);
        return errorResponse(res, '导入失败', 500);
    }
}

// ==================== AI审核功能 ====================

const aiReview = require('../services/aiReview');

async function aiReviewReport(req, res) {
    try {
        const { reportId } = req.params;
        
        const report = await DbAdapter.findByPk(Report, reportId, {
            include: [
                { model: Work, as: 'work', attributes: ['id', 'name', 'description'] },
                { model: Comment, as: 'comment', attributes: ['id', 'content'] }
            ]
        });
        
        if (!report) {
            return errorResponse(res, '举报不存在', 404);
        }
        
        let content = '';
        let type = '作品';
        if (report.type === 'work') {
            content = `作品名称: ${report.work?.name || ''}\n作品描述: ${report.work?.description || ''}`;
            type = '作品';
        } else if (report.type === 'comment') {
            content = report.comment?.content || '';
            type = '评论';
        } else if (report.type === 'user') {
            content = report.description || '';
            type = '用户';
        }
        
        const result = await aiReview.reviewContent(type, content);
        
        logOperation(req, 'ai_review', 'report', reportId, {
            type,
            riskLevel: result.riskLevel,
            violations: result.violations,
            recommendation: result.recommendation,
            confidence: result.confidence
        });
        
        return successResponse(res, {
            success: result.success,
            riskLevel: result.riskLevel,
            violations: result.violations || [],
            reason: result.reason || '',
            recommendation: result.recommendation,
            confidence: result.confidence,
            error: result.error || null
        });
    } catch (error) {
        console.error('AI审核错误:', error);
        return errorResponse(res, 'AI审核失败', 500);
    }
}

async function aiBatchReviewReports(req, res) {
    try {
        const { reportIds } = req.body;
        const results = [];
        
        for (const reportId of reportIds) {
            const report = await DbAdapter.findByPk(Report, reportId, {
                include: [
                    { model: Work, as: 'work', attributes: ['name', 'description'] },
                    { model: Comment, as: 'comment', attributes: ['content'] }
                ]
            });
            if (!report) continue;
            
            let content = '';
            let type = '作品';
            if (report.type === 'work') {
                content = `作品名称: ${report.work?.name || ''}\n作品描述: ${report.work?.description || ''}`;
                type = '作品';
            } else if (report.type === 'comment') {
                content = report.comment?.content || '';
                type = '评论';
            }
            
            const result = await aiReview.reviewContent(type, content);
            
            results.push({
                reportId,
                riskLevel: result.riskLevel,
                violations: result.violations || [],
                recommendation: result.recommendation,
                confidence: result.confidence
            });
        }
        
        return successResponse(res, results);
    } catch (error) {
        console.error('批量AI审核错误:', error);
        return errorResponse(res, '批量审核失败', 500);
    }
}

async function aiAutoHandleReports(req, res) {
    try {
        const { reportIds } = req.body;
        const results = { handled: 0, passed: 0, deleted: 0 };
        
        for (const reportId of reportIds) {
            const report = await DbAdapter.findByPk(Report, reportId);
            if (!report || report.status !== 'pending') continue;
            
            // AI审核
            const sensitiveWords = await DbAdapter.findAll(SensitiveWord, { where: { status: 'active' } });
            let riskLevel = 'low';
            let content = report.description || '';
            
            for (const sw of sensitiveWords) {
                if (content.includes(sw.word)) {
                    if (sw.level === 'high') { riskLevel = 'high'; break; }
                    if (sw.level === 'medium') riskLevel = 'medium';
                }
            }
            
            if (riskLevel === 'high') {
                // 自动删除
                if (report.type === 'work') {
                    await DbAdapter.update(Work, { status: 'deleted' }, { where: { id: report.target_id } });
                } else if (report.type === 'comment') {
                    await DbAdapter.update(Comment, { status: 'deleted' }, { where: { id: report.target_id } });
                } else if (report.type === 'post') {
                    await DbAdapter.update(Post, { status: 'deleted' }, { where: { id: report.target_id } });
                }
                await DbAdapter.update(Report, { status: 'resolved', handler_id: DbAdapter.getId(req.user), handle_note: 'AI自动处理-删除' }, { where: { id: DbAdapter.getId(report) } });
                results.deleted++;
            } else {
                // 通过
                await DbAdapter.update(Report, { status: 'rejected', handler_id: DbAdapter.getId(req.user), handle_note: 'AI自动处理-通过' }, { where: { id: DbAdapter.getId(report) } });
                results.passed++;
            }
            
            results.handled++;
        }
        
        logOperation(req, 'ai_auto_handle_reports', 'report', null, results);
        return successResponse(res, results, `AI自动处理完成，共处理${results.handled}条举报`);
    } catch (error) {
        console.error('AI自动处理错误:', error);
        return errorResponse(res, '处理失败', 500);
    }
}

// ==================== 权限管理 ====================

async function getPermissions(req, res) {
    try {
        const permissions = getAllPermissions();
        return successResponse(res, permissions);
    } catch (error) {
        console.error('获取权限列表错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

async function getRolePermissionsList(req, res) {
    try {
        // 刷新缓存并获取最新角色权限
        await refreshRoleCache(RolePermission);
        const roles = getAllRoles();
        return successResponse(res, roles);
    } catch (error) {
        console.error('获取角色权限错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

async function updateRolePermissions(req, res) {
    try {
        const { role } = req.params;
        const { name, level, permissions } = req.body;
        
        // 不能修改超级管理员权限
        if (role === 'superadmin') {
            return errorResponse(res, '不能修改超级管理员权限', 403);
        }
        
        // 检查角色是否存在
        if (!DEFAULT_ROLES[role]) {
            return errorResponse(res, '角色不存在', 404);
        }
        
        // 更新或创建角色权限
        let rolePerm = await DbAdapter.findOne(RolePermission, { where: { role } });
        
        if (rolePerm) {
            await DbAdapter.update(RolePermission, {
                name: name || rolePerm.name,
                level: level !== undefined ? level : rolePerm.level,
                permissions: JSON.stringify(permissions || [])
            }, { where: { role } });
        } else {
            rolePerm = await DbAdapter.create(RolePermission, {
                role,
                name: name || DEFAULT_ROLES[role].name,
                level: level !== undefined ? level : DEFAULT_ROLES[role].level,
                permissions: JSON.stringify(permissions || [])
            });
        }
        
        // 刷新缓存
        await refreshRoleCache(RolePermission);
        
        logOperation(req, 'update_role_permissions', 'role', null, { role, name, level, permissions });
        return successResponse(res, {
            role,
            name: rolePerm.name,
            level: rolePerm.level,
            permissions: JSON.parse(rolePerm.permissions)
        }, '权限更新成功');
    } catch (error) {
        console.error('更新角色权限错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

async function resetRolePermissions(req, res) {
    try {
        const { role } = req.params;
        
        if (role === 'superadmin') {
            return errorResponse(res, '不能重置超级管理员权限', 403);
        }
        
        if (!DEFAULT_ROLES[role]) {
            return errorResponse(res, '角色不存在', 404);
        }
        
        // 删除自定义权限，恢复默认
        await DbAdapter.destroy(RolePermission, { where: { role } });
        
        // 刷新缓存
        await refreshRoleCache(RolePermission);
        
        logOperation(req, 'reset_role_permissions', 'role', null, { role });
        return successResponse(res, DEFAULT_ROLES[role], '权限已重置为默认');
    } catch (error) {
        console.error('重置角色权限错误:', error);
        return errorResponse(res, '重置失败', 500);
    }
}

async function getCaptchaStats(req, res) {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        
        const stats = await DbAdapter.findAll(CaptchaStats, {
            where: {
                created_at: { [Op.gte]: startDate }
            },
            attributes: [
                'type',
                'action',
                [sequelize.fn('COUNT', '*'), 'count']
            ],
            group: ['type', 'action']
        });
        
        const geetestStats = { show: 0, pass: 0, block: 0 };
        const hcaptchaStats = { show: 0, pass: 0, block: 0 };
        
        stats.forEach(s => {
            const data = s.toJSON();
            if (data.type === 'geetest') {
                geetestStats[data.action] = parseInt(data.count);
            } else if (data.type === 'hcaptcha') {
                hcaptchaStats[data.action] = parseInt(data.count);
            }
        });
        
        const dailyStats = await DbAdapter.findAll(CaptchaStats, {
            where: {
                created_at: { [Op.gte]: startDate }
            },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                'type',
                'action',
                [sequelize.fn('COUNT', '*'), 'count']
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at')), 'type', 'action'],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
        });
        
        return successResponse(res, {
            geetest: geetestStats,
            hcaptcha: hcaptchaStats,
            daily: dailyStats.map(s => s.toJSON())
        });
    } catch (error) {
        console.error('获取验证码统计错误:', error);
        return errorResponse(res, '获取统计失败', 500);
    }
}

async function getStudios(req, res) {
    try {
        const { page = 1, pageSize = 20, keyword, status } = req.query;
        const where = {};
        
        if (keyword) {
            where.name = { [Op.like]: `%${keyword}%` };
        }
        if (status) {
            where.status = status;
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(Studio, {
            where,
            include: [{
                model: User,
                as: 'owner',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(pageSize),
            offset: (parseInt(page) - 1) * parseInt(pageSize)
        });
        
        return paginateResponse(res, rows, count, parseInt(page), parseInt(pageSize));
    } catch (error) {
        console.error('获取工作室列表错误:', error);
        return errorResponse(res, '获取工作室列表失败', 500);
    }
}

async function updateStudioStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        await DbAdapter.update(Studio, { status }, { where: { id } });
        logOperation(req, 'update_studio_status', 'studio', id, { status });
        
        return successResponse(res, studio, '工作室状态已更新');
    } catch (error) {
        console.error('更新工作室状态错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

async function updateStudio(req, res) {
    try {
        const { id } = req.params;
        const { name, description, cover, join_type, status, vice_owner_id } = req.body;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        await DbAdapter.update(Studio, {
            name: name || studio.name,
            description: description !== undefined ? description : studio.description,
            cover: cover !== undefined ? cover : studio.cover,
            join_type: join_type || studio.join_type,
            status: status || studio.status,
            vice_owner_id: vice_owner_id !== undefined ? vice_owner_id : studio.vice_owner_id
        }, { where: { id } });
        
        logOperation(req, 'update_studio', 'studio', id, req.body);
        
        return successResponse(res, studio, '工作室已更新');
    } catch (error) {
        console.error('更新工作室错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

async function setWorkScore(req, res) {
    try {
        const { id } = req.params;
        const { score } = req.body;
        
        const StudioWork = require('../models').StudioWork;
        const studioWork = await DbAdapter.findByPk(StudioWork, id);
        if (!studioWork) {
            return errorResponse(res, '作品记录不存在', 404);
        }
        
        const oldScore = studioWork.score || 0;
        await DbAdapter.update(StudioWork, { score }, { where: { id } });
        
        const studio = await DbAdapter.findByPk(Studio, studioWork.studio_id);
        if (studio) {
            const totalScore = await DbAdapter.sum(StudioWork, 'score', { where: { studio_id: studioWork.studio_id, status: 'approved' } }) || 0;
            await DbAdapter.update(Studio, { total_score: totalScore }, { where: { id: DbAdapter.getId(studio) } });
        }
        
        logOperation(req, 'set_work_score', 'studio_work', id, { oldScore, newScore: score });
        
        return successResponse(res, { score, totalScore: studio?.total_score || 0 }, '积分已更新');
    } catch (error) {
        console.error('设置作品积分错误:', error);
        return errorResponse(res, '设置失败', 500);
    }
}

async function updateUserLevel(req, res) {
    try {
        const { userId } = req.params;
        const { level } = req.body;
        const operatorRole = req.user.role;
        
        // 只有超级管理员可以修改用户等级
        if (operatorRole !== 'superadmin') {
            return errorResponse(res, '只有超级管理员可以修改用户等级', 403);
        }
        
        if (level < 1 || level > 100) {
            return errorResponse(res, '等级必须在1-100之间', 400);
        }
        
        const user = await DbAdapter.findByPk(User, userId);
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        const oldLevel = user.level || 1;
        await DbAdapter.update(User, { level }, { where: { id: userId } });
        logOperation(req, 'update_user_level', 'user', userId, { oldLevel, newLevel: level });
        
        return successResponse(res, { id: DbAdapter.getId(user), level }, '用户等级已更新');
    } catch (error) {
        console.error('更新用户等级错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

async function deleteStudio(req, res) {
    try {
        const { id } = req.params;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        await DbAdapter.destroy(StudioMember, { where: { studio_id: id } });
        await DbAdapter.destroy(Studio, { where: { id: DbAdapter.getId(studio) } });
        
        logOperation(req, 'delete_studio', 'studio', id);
        return successResponse(res, null, '工作室已删除');
    } catch (error) {
        console.error('删除工作室错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

async function getStudioDetail(req, res) {
    try {
        const { id } = req.params;
        
        const studio = await DbAdapter.findByPk(Studio, id, {
            include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'nickname', 'avatar'] }]
        });
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        const members = await DbAdapter.findAll(StudioMember, {
            where: { studio_id: id },
            include: [{ model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] }],
            order: [['role', 'ASC']]
        });
        
        const studioWorks = await DbAdapter.findAll(StudioWork, {
            where: { studio_id: id },
            include: [{ model: Work, as: 'work', include: [{ model: User, as: 'author', attributes: ['id', 'nickname'] }] }],
            order: [['added_at', 'DESC']],
            limit: 50
        });
        
        return successResponse(res, {
            studio,
            owner: studio.owner,
            members,
            works: studioWorks.map(sw => sw.work).filter(w => w)
        });
        
        logOperation(req, 'view_studio_detail', 'studio', id, { name: studio.name });
    } catch (error) {
        console.error('获取工作室详情错误:', error);
        return errorResponse(res, '获取工作室详情失败', 500);
    }
}

async function updateStudioMember(req, res) {
    try {
        const { studioId, userId } = req.params;
        const { role } = req.body;
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: studioId, user_id: userId }
        });
        if (!member) {
            return errorResponse(res, '成员不存在', 404);
        }
        
        if (member.role === 'owner') {
            return errorResponse(res, '不能修改室长角色', 400);
        }
        
        await DbAdapter.update(StudioMember, { role }, { where: { id: DbAdapter.getId(member) } });
        logOperation(req, 'update_studio_member', 'studio_member', DbAdapter.getId(member), { role });
        
        return successResponse(res, null, '成员角色已更新');
    } catch (error) {
        console.error('更新成员角色错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

async function removeStudioMember(req, res) {
    try {
        const { studioId, userId } = req.params;
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: studioId, user_id: userId }
        });
        if (!member) {
            return errorResponse(res, '成员不存在', 404);
        }
        
        if (member.role === 'owner') {
            return errorResponse(res, '不能移除室长', 400);
        }
        
        const studio = await DbAdapter.findByPk(Studio, studioId);
        
        await DbAdapter.destroy(StudioMember, { where: { id: DbAdapter.getId(member) } });
        if (studio) {
            await DbAdapter.decrement(studio, 'member_count');
        }
        
        logOperation(req, 'remove_studio_member', 'studio_member', DbAdapter.getId(member));
        return successResponse(res, null, '成员已移除');
    } catch (error) {
        console.error('移除成员错误:', error);
        return errorResponse(res, '移除失败', 500);
    }
}

async function removeStudioWork(req, res) {
    try {
        const { studioId, workId } = req.params;
        
        const studioWork = await DbAdapter.findOne(StudioWork, {
            where: { studio_id: studioId, work_id: workId }
        });
        if (!studioWork) {
            return errorResponse(res, '作品不存在于工作室', 404);
        }
        
        await DbAdapter.destroy(StudioWork, { where: { id: DbAdapter.getId(studioWork) } });
        
        logOperation(req, 'remove_studio_work', 'studio_work', DbAdapter.getId(studioWork));
        return successResponse(res, null, '作品已移除');
    } catch (error) {
        console.error('移除作品错误:', error);
        return errorResponse(res, '移除失败', 500);
    }
}

async function sendUserNotification(req, res) {
    try {
        const { userId } = req.params;
        const { title, content } = req.body;
        
        if (!title || !content) {
            return errorResponse(res, '标题和内容不能为空', 400);
        }
        
        const user = await DbAdapter.findByPk(User, userId);
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        await DbAdapter.create(Notification, {
            user_id: userId,
            type: 'system',
            title,
            content,
            sender_id: DbAdapter.getId(req.user)
        });
        
        logOperation(req, 'send_notification', 'user', userId, { title });
        return successResponse(res, null, '站内信发送成功');
    } catch (error) {
        console.error('发送站内信错误:', error);
        return errorResponse(res, '发送失败', 500);
    }
}

async function sendBatchNotifications(req, res) {
    try {
        const { userIds, title, content } = req.body;
        
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return errorResponse(res, '请选择接收用户', 400);
        }
        
        if (!title || !content) {
            return errorResponse(res, '标题和内容不能为空', 400);
        }
        
        const notifications = userIds.map(userId => ({
            user_id: userId,
            type: 'system',
            title,
            content,
            sender_id: DbAdapter.getId(req.user)
        }));
        
        await DbAdapter.bulkCreate(Notification, notifications);
        
        logOperation(req, 'send_batch_notifications', 'notification', null, { count: userIds.length, title });
        return successResponse(res, { count: userIds.length }, `成功发送给 ${userIds.length} 个用户`);
    } catch (error) {
        console.error('批量发送站内信错误:', error);
        return errorResponse(res, '发送失败', 500);
    }
}

async function sendAllUsersNotification(req, res) {
    try {
        const { title, content } = req.body;
        
        if (!title || !content) {
            return errorResponse(res, '标题和内容不能为空', 400);
        }
        
        const users = await DbAdapter.findAll(User, {
            where: { status: 'active' },
            attributes: ['id']
        });
        
        if (users.length === 0) {
            return errorResponse(res, '没有可发送的用户', 400);
        }
        
        const notifications = users.map(user => ({
            user_id: DbAdapter.getId(user),
            type: 'system',
            title,
            content,
            sender_id: DbAdapter.getId(req.user)
        }));
        
        await DbAdapter.bulkCreate(Notification, notifications);
        
        logOperation(req, 'send_all_notification', 'notification', null, { count: users.length, title });
        return successResponse(res, { count: users.length }, `成功发送给全部 ${users.length} 个用户`);
    } catch (error) {
        console.error('全员发送站内信错误:', error);
        return errorResponse(res, '发送失败', 500);
    }
}

async function updateStudioPoints(req, res) {
    try {
        const { id } = req.params;
        const { points, action, note } = req.body;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        let newPoints;
        if (action === 'add') {
            newPoints = Math.max(0, (studio.points || 0) + parseInt(points || 0));
        } else {
            newPoints = Math.max(0, parseInt(points) || 0);
        }
        
        const newLevel = Math.min(10, Math.floor(newPoints / 100) + 1);
        
        await DbAdapter.update(Studio, { points: newPoints, level: newLevel }, { where: { id } });
        logOperation(req, 'update_studio_points', 'studio', id, { 
            oldPoints: studio.points, 
            newPoints, 
            action, 
            note 
        });
        
        return successResponse(res, studio, '积分已更新');
    } catch (error) {
        console.error('更新工作室积分错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

module.exports = {
    getStats,
    getUsers,
    getUserDetail,
    updateUserStatus,
    updateUserRole,
    updateUserPassword,
    deleteUser,
    getWorks,
    setWorkFeatured,
    deleteWork,
    crawlWork,
    crawlHotWorks,
    crawlUserWorks,
    crawlPostWorks,
    crawlBanners,
    getCrawlLogs,
    getRealtimeLogs,
    clearRealtimeLogs,
    getBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    getComments,
    updateCommentStatus,
    deleteComment,
    getReports,
    handleReport,
    getIpBans,
    addIpBan,
    removeIpBan,
    getTrends,
    getRoles,
    getAdminUsers,
    getAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getSystemConfigs,
    updateSystemConfig,
    batchUpdateConfigs,
    getOperationLogs,
    getSensitiveWords,
    addSensitiveWord,
    updateSensitiveWord,
    deleteSensitiveWord,
    batchImportSensitiveWords,
    aiReviewReport,
    aiBatchReviewReports,
    aiAutoHandleReports,
    getPermissions,
    getRolePermissionsList,
    updateRolePermissions,
    resetRolePermissions,
    getCaptchaStats,
    getStudios,
    getStudioDetail,
    updateStudio,
    updateStudioStatus,
    updateStudioMember,
    removeStudioMember,
    removeStudioWork,
    deleteStudio,
    sendUserNotification,
    sendBatchNotifications,
    sendAllUsersNotification,
    updateStudioPoints,
    setWorkScore,
    updateUserLevel,
    updateUser,
    impersonateUser,
    updateWork,
    updatePost,
    getPosts,
    deletePost,
    setPostEssence,
    setPostTop,
    recalibrateAllWorks
};

/**
 * 重新校准全站作品数据 (IDE 类型和播放器)
 */
async function recalibrateAllWorks(req, res) {
    try {
        const works = await DbAdapter.findAll(Work);
        let updatedCount = 0;
        let failedCount = 0;

        console.log(`开始重新校准 ${works.length} 个作品的数据...`);

        // 使用异步循环，但控制并发或分批，避免被编程猫封禁
        for (const work of works) {
            try {
                if (!work.codemao_work_id) continue;

                const workDetail = await codemaoApi.getWorkDetail(work.codemao_work_id);
                if (!workDetail) {
                    console.error(`无法获取作品详情: ${work.codemao_work_id}`);
                    failedCount++;
                    continue;
                }

                const updateData = {
                    type: workDetail.type || 'KITTEN',
                    work_url: workDetail.player_url || work.work_url
                };

                await DbAdapter.update(Work, updateData, { where: { id: DbAdapter.getId(work) } });
                updatedCount++;
                
                if (updatedCount % 10 === 0) {
                    console.log(`已校准 ${updatedCount}/${works.length} 个作品...`);
                }

                // 稍微延迟，避免 API 请求过快
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                console.error(`校准作品 ${work.codemao_work_id} 出错:`, e.message);
                failedCount++;
            }
        }

        logOperation(req, 'recalibrate_works', 'work', 'all', { updatedCount, failedCount });
        
        return successResponse(res, { updatedCount, failedCount }, `校准完成，成功更新 ${updatedCount} 个作品，失败 ${failedCount} 个`);
    } catch (error) {
        console.error('重新校准作品错误:', error);
        return errorResponse(res, '校准失败', 500);
    }
}

/**
 * 获取帖子列表 (管理)
 */
async function getPosts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const keyword = req.query.keyword || '';
        const category = req.query.category || '';
        const status = req.query.status || '';

        const where = {};
        if (keyword) {
            where[Op.or] = [
                { title: { [Op.like]: `%${keyword}%` } },
                { content: { [Op.like]: `%${keyword}%` } }
            ];
        }
        if (category) where.category = category;
        if (status) where.status = status;

        const { count, rows } = await DbAdapter.findAndCountAll(Post, {
            where,
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }],
            order: [['is_top', 'DESC'], ['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取帖子列表错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

/**
 * 删除帖子 (管理)
 */
async function deletePost(req, res) {
    try {
        const { postId } = req.params;
        const post = await DbAdapter.findByPk(Post, postId);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        await DbAdapter.destroy(Post, { where: { id: postId } });
        logOperation(req, 'delete_post', 'post', postId, { title: post.title });
        return successResponse(res, null, '删除成功');
    } catch (error) {
        console.error('删除帖子错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

/**
 * 更新帖子信息
 */
async function updatePost(req, res) {
    try {
        const { postId } = req.params;
        const { title, content, category, status, is_top, is_essence } = req.body;

        const post = await DbAdapter.findByPk(Post, postId);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (category !== undefined) updateData.category = category;
        if (status !== undefined) updateData.status = status;
        if (is_top !== undefined) updateData.is_top = is_top;
        if (is_essence !== undefined) updateData.is_essence = is_essence;

        await DbAdapter.update(Post, updateData, { where: { id: postId } });
        logOperation(req, 'update_post', 'post', postId, updateData);

        return successResponse(res, null, '更新成功');
    } catch (error) {
        console.error('更新帖子错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

/**
 * 设置帖子精华
 */
async function setPostEssence(req, res) {
    try {
        const { postId } = req.params;
        const { isEssence } = req.body;
        
        const post = await DbAdapter.findByPk(Post, postId);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        await DbAdapter.update(Post, { is_essence: isEssence }, { where: { id: postId } });
        logOperation(req, 'set_post_essence', 'post', postId, { isEssence });
        
        return successResponse(res, null, '设置成功');
    } catch (error) {
        console.error('设置精华帖错误:', error);
        return errorResponse(res, '设置失败', 500);
    }
}

/**
 * 设置帖子置顶
 */
async function setPostTop(req, res) {
    try {
        const { postId } = req.params;
        const { isTop } = req.body;
        
        const post = await DbAdapter.findByPk(Post, postId);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        await DbAdapter.update(Post, { is_top: isTop }, { where: { id: postId } });
        logOperation(req, 'set_post_top', 'post', postId, { isTop });
        
        return successResponse(res, null, '设置成功');
    } catch (error) {
        console.error('设置置顶帖错误:', error);
        return errorResponse(res, '设置失败', 500);
    }
}

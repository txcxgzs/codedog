const DbAdapter = require('../utils/dbAdapter');
/**
 * 关注控制器
 */

const { Follow, User, Notification, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');

/**
 * 关注用户（使用编程猫用户ID）
 */
async function followUser(req, res) {
    try {
        const { codemaoUserId } = req.body;
        
        if (!codemaoUserId) {
            return errorResponse(res, '请提供用户ID', 400);
        }
        
        // 通过编程猫用户ID找到目标用户
        const targetUser = await DbAdapter.findOne(User, { where: { codemao_user_id: codemaoUserId } });
        if (!targetUser) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        if (targetUser.id === DbAdapter.getId(req.user)) {
            return errorResponse(res, '不能关注自己', 400);
        }
        
        // 检查是否已关注
        const existing = await DbAdapter.findOne(Follow, {
            where: { follower_id: DbAdapter.getId(req.user), following_id: targetUser.id }
        });
        
        if (existing) {
            return errorResponse(res, '已关注该用户', 400);
        }
        
        // 创建关注 + 更新计数（事务保证一致性）
        try {
            await sequelize.transaction(async (t) => {
                await DbAdapter.create(Follow, {
                    follower_id: DbAdapter.getId(req.user),
                    following_id: targetUser.id
                }, { transaction: t });

                const currentUser = await DbAdapter.findByPk(User, DbAdapter.getId(req.user), { transaction: t });
                if (currentUser) await DbAdapter.increment(currentUser, 'following_count', { transaction: t });

                const target = await DbAdapter.findByPk(User, DbAdapter.getId(targetUser), { transaction: t });
                if (target) await DbAdapter.increment(target, 'follower_count', { transaction: t });
            });
        } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
                return errorResponse(res, '已关注该用户', 400);
            }
            throw createError;
        }
        
        try {
            await DbAdapter.create(Notification, {
                user_id: targetUser.id,
                type: 'follow',
                title: '关注了你',
                sender_id: DbAdapter.getId(req.user)
            });
        } catch (e) { console.error('创建关注通知失败:', e.message); }
        
        return successResponse(res, null, '关注成功');
    } catch (error) {
        console.error('关注错误:', error);
        return errorResponse(res, '关注失败', 500);
    }
}

/**
 * 取消关注（使用编程猫用户ID）
 */
async function unfollowUser(req, res) {
    try {
        const { codemaoUserId } = req.params;
        
        // 通过编程猫用户ID找到目标用户
        const targetUser = await DbAdapter.findOne(User, { where: { codemao_user_id: codemaoUserId } });
        if (!targetUser) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        const follow = await DbAdapter.findOne(Follow, {
            where: { follower_id: DbAdapter.getId(req.user), following_id: targetUser.id }
        });
        
        if (!follow) {
            return errorResponse(res, '未关注该用户', 400);
        }
        
        // 取消关注 + 更新计数（事务保证一致性）
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(Follow, { where: { id: DbAdapter.getId(follow) }, transaction: t });

            const currentUser = await DbAdapter.findByPk(User, DbAdapter.getId(req.user), { transaction: t });
            if (currentUser && (currentUser.following_count || 0) > 0) {
                await DbAdapter.decrement(currentUser, 'following_count', { transaction: t });
            }

            const freshTarget = await DbAdapter.findByPk(User, DbAdapter.getId(targetUser), { transaction: t });
            if (freshTarget && (freshTarget.follower_count || 0) > 0) {
                await DbAdapter.decrement(freshTarget, 'follower_count', { transaction: t });
            }
        });
        
        return successResponse(res, null, '已取消关注');
    } catch (error) {
        console.error('取消关注错误:', error);
        return errorResponse(res, '取消关注失败', 500);
    }
}

/**
 * 获取用户粉丝列表（使用编程猫用户ID）
 */
async function getFollowers(req, res) {
    try {
        const { codemaoUserId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        
        // 通过编程猫用户ID找到用户
        const user = await DbAdapter.findOne(User, { where: { codemao_user_id: codemaoUserId } });
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(Follow, {
            where: { following_id: user.id },
            include: [{
                model: User,
                as: 'follower',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio', 'follower_count', 'work_count']
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        const list = rows.map(f => f.follower).filter(u => u);
        
        return successResponse(res, { list, total: count });
    } catch (error) {
        console.error('获取粉丝列表错误:', error);
        return errorResponse(res, '获取粉丝列表失败', 500);
    }
}

/**
 * 获取用户关注列表（使用编程猫用户ID）
 */
async function getFollowing(req, res) {
    try {
        const { codemaoUserId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        
        // 通过编程猫用户ID找到用户
        const user = await DbAdapter.findOne(User, { where: { codemao_user_id: codemaoUserId } });
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(Follow, {
            where: { follower_id: user.id },
            include: [{
                model: User,
                as: 'following',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio', 'follower_count', 'work_count']
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        const list = rows.map(f => f.following).filter(u => u);
        
        return successResponse(res, { list, total: count });
    } catch (error) {
        console.error('获取关注列表错误:', error);
        return errorResponse(res, '获取关注列表失败', 500);
    }
}

/**
 * 检查是否已关注（使用编程猫用户ID）
 */
async function checkFollow(req, res) {
    try {
        const { codemaoUserId } = req.params;
        
        // 通过编程猫用户ID找到目标用户
        const targetUser = await DbAdapter.findOne(User, { where: { codemao_user_id: codemaoUserId } });
        if (!targetUser) {
            return successResponse(res, { isFollowing: false });
        }
        
        const follow = await DbAdapter.findOne(Follow, {
            where: { follower_id: DbAdapter.getId(req.user), following_id: targetUser.id }
        });
        
        return successResponse(res, { isFollowing: !!follow });
    } catch (error) {
        console.error('检查关注错误:', error);
        return errorResponse(res, '检查关注失败', 500);
    }
}

module.exports = {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    checkFollow
};

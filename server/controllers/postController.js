const DbAdapter = require('../utils/dbAdapter');
/**
 * 社区帖子控制器
 */

const { Post, User, Comment } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { Op } = require('sequelize');
const { isRoleAtLeast } = require('../config/permissions');
const { escapeLike } = require('../utils/security');

function canInteractWithPost(post) {
    return post && post.status === 'published';
}

/**
 * 规范化帖子输出：tags 字段统一转换为数组
 * （Sequelize 自定义 setter 仅在通过实例写时生效；
 *  通过 findAll/raw 拿到的 records 仍可能为字符串）
 */
function normalizePostOutput(post) {
    if (!post) return post;
    const json = post.toJSON ? post.toJSON() : post;
    if (typeof json.tags === 'string') {
        try {
            const parsed = JSON.parse(json.tags);
            json.tags = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            json.tags = [];
        }
    }
    if (!Array.isArray(json.tags)) {
        json.tags = [];
    }
    return json;
}

/**
 * 发布帖子
 */
async function createPost(req, res) {
    try {
        const { title, content, category, tags, cover } = req.body;
        
        if (!title || !content) {
            return errorResponse(res, '请填写标题和内容', 400);
        }
        
        const post = await DbAdapter.create(Post, {
            title,
            content,
            user_id: DbAdapter.getId(req.user),
            category: category || 'discussion',
            tags,
            cover
        });
        
        const result = await DbAdapter.findByPk(Post, post.id, {
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }]
        });
        
        return successResponse(res, result, '发布成功');
    } catch (error) {
        console.error('发布帖子错误:', error);
        return errorResponse(res, '发布失败', 500);
    }
}

/**
 * 获取帖子列表
 */
async function getPosts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const category = req.query.category || '';
        const keyword = req.query.keyword || '';
        const sortBy = req.query.sortBy || 'latest';
        const isTop = req.query.isTop;
        
        // 统一使用 'published' 状态
        const where = { status: 'published' };
        
        if (category === 'essence') {
            where.is_essence = true;
        } else if (category === 'official') {
            where.category = 'news'; // 或者直接使用 category=news
        } else if (category) {
            where.category = category;
        }

        if (isTop === 'true') {
            where.is_top = true;
        }
        
        if (keyword) {
            const safeKeyword = escapeLike(keyword);
            where[Op.or] = [
                { title: { [Op.like]: `%${safeKeyword}%` } },
                { content: { [Op.like]: `%${safeKeyword}%` } }
            ];
        }
        
        let order = [['is_top', 'DESC'], ['created_at', 'DESC']];
        if (sortBy === 'hot') {
            order = [['is_top', 'DESC'], ['view_count', 'DESC']];
        } else if (sortBy === 'essence') {
            where.is_essence = true;
            order = [['is_top', 'DESC'], ['created_at', 'DESC']];
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(Post, {
            where,
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }],
            order,
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows.map(normalizePostOutput), count, page, pageSize);
    } catch (error) {
        console.error('获取帖子列表错误:', error);
        return errorResponse(res, '获取帖子列表失败', 500);
    }
}

/**
 * 获取帖子详情
 */
async function getPostDetail(req, res) {
    try {
        const { id } = req.params;
        
        const post = await DbAdapter.findByPk(Post, id, {
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar', 'bio']
            }]
        });
        
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        if (post.status !== 'published') {
            return errorResponse(res, '帖子不存在', 404);
        }

        // 原子 +1 避免 read-modify-write 竞态
        await DbAdapter.increment(post, 'view_count');
        
        const comments = await DbAdapter.findAll(Comment, {
            where: { post_id: id, status: 'active', parent_id: null },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }, {
                model: Comment,
                as: 'replies',
                where: { status: 'active' },
                required: false,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'nickname', 'avatar']
                }]
            }],
            order: [['created_at', 'DESC']]
        });
        
        return successResponse(res, normalizePostOutput({ ...post.toJSON(), view_count: (post.view_count || 0) + 1, comments }));
    } catch (error) {
        console.error('获取帖子详情错误:', error);
        return errorResponse(res, '获取帖子详情失败', 500);
    }
}

/**
 * 更新帖子
 */
async function updatePost(req, res) {
    try {
        const { id } = req.params;
        const { title, content, category, tags, cover } = req.body;
        
        const post = await DbAdapter.findByPk(Post, id);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        if (post.user_id !== DbAdapter.getId(req.user)) {
            return errorResponse(res, '无权修改此帖子', 403);
        }
        
        await DbAdapter.update(Post, {
            title: title || post.title,
            content: content || post.content,
            category: category || post.category,
            tags: tags !== undefined ? tags : post.tags,
            cover: cover || post.cover
        }, { where: { id } });
        
        const updatedPost = await DbAdapter.findByPk(Post, id, {
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }]
        });
        
        return successResponse(res, updatedPost, '帖子已更新');
    } catch (error) {
        console.error('更新帖子错误:', error);
        return errorResponse(res, '更新帖子失败', 500);
    }
}

/**
 * 删除帖子
 */
async function deletePost(req, res) {
    try {
        const { id } = req.params;
        
        const post = await DbAdapter.findByPk(Post, id);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        if (post.user_id !== DbAdapter.getId(req.user) && !isRoleAtLeast(req.user.role, 'moderator')) {
            return errorResponse(res, '无权删除此帖子', 403);
        }
        
        await DbAdapter.update(Post, { status: 'deleted' }, { where: { id } });
        
        return successResponse(res, null, '帖子已删除');
    } catch (error) {
        console.error('删除帖子错误:', error);
        return errorResponse(res, '删除帖子失败', 500);
    }
}

/**
 * 点赞帖子
 */
async function likePost(req, res) {
    try {
        const { id } = req.params;
        const { Like } = require('../models');
        const userId = DbAdapter.getId(req.user);
        
        const post = await DbAdapter.findByPk(Post, id);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        if (!canInteractWithPost(post)) {
            return errorResponse(res, 'Post not found', 404);
        }

        const existingLike = await DbAdapter.findOne(Like, {
            where: { user_id: userId, post_id: DbAdapter.getId(post) }
        });
        
        if (existingLike) {
            await DbAdapter.destroy(Like, { where: { id: DbAdapter.getId(existingLike) } });
            // 原子 -1 避免 read-modify-write 竞态
            await DbAdapter.decrement(post, 'like_count');
            await post.reload();
            const newCount = Math.max(0, post.like_count || 0);
            return successResponse(res, { like_count: newCount, liked: false }, '已取消点赞');
        }

        await DbAdapter.create(Like, {
            user_id: userId,
            post_id: DbAdapter.getId(post)
        });

        // 原子 +1 避免 read-modify-write 竞态
        await DbAdapter.increment(post, 'like_count');
        await post.reload();

        // 通知帖子作者（与 work like 行为保持一致）
        if (post.user_id != null && String(post.user_id) !== String(userId)) {
            try {
                const { Notification } = require('../models');
                await DbAdapter.create(Notification, {
                    user_id: post.user_id,
                    type: 'like',
                    title: '点赞了你的帖子',
                    content: post.title,
                    related_id: DbAdapter.getId(post),
                    related_type: 'post',
                    sender_id: userId
                });
            } catch (notifyErr) {
                // 通知失败不应回滚点赞主流程
                console.error('Create post like notification error:', notifyErr);
            }
        }

        return successResponse(res, { like_count: post.like_count || 0, liked: true }, '点赞成功');
    } catch (error) {
        console.error('点赞错误:', error);
        return errorResponse(res, '点赞失败', 500);
    }
}

/**
 * 收藏帖子
 */
async function favoritePost(req, res) {
    try {
        const { id } = req.params;
        const { Favorite } = require('../models');
        const userId = DbAdapter.getId(req.user);
        
        const post = await DbAdapter.findByPk(Post, id);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        if (!canInteractWithPost(post)) {
            return errorResponse(res, 'Post not found', 404);
        }

        const existing = await DbAdapter.findOne(Favorite, {
            where: { user_id: userId, post_id: DbAdapter.getId(post) }
        });
        
        if (existing) {
            return errorResponse(res, '已收藏该帖子', 400);
        }
        
        await DbAdapter.create(Favorite, {
            user_id: userId,
            post_id: DbAdapter.getId(post)
        });
        
        const newCount = (post.collection_count || 0) + 1;
        await DbAdapter.update(Post, 
            { collection_count: newCount },
            { where: { id: DbAdapter.getId(post) } }
        );
        
        return successResponse(res, { collection_count: newCount, favorited: true }, '收藏成功');
    } catch (error) {
        console.error('收藏错误:', error);
        return errorResponse(res, '收藏失败', 500);
    }
}

/**
 * 取消收藏帖子
 */
async function unfavoritePost(req, res) {
    try {
        const { id } = req.params;
        const { Favorite } = require('../models');
        const userId = DbAdapter.getId(req.user);
        
        const post = await DbAdapter.findByPk(Post, id);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        if (!canInteractWithPost(post)) {
            return errorResponse(res, 'Post not found', 404);
        }

        const existing = await DbAdapter.findOne(Favorite, {
            where: { user_id: userId, post_id: DbAdapter.getId(post) }
        });
        
        if (!existing) {
            return errorResponse(res, '未收藏该帖子', 400);
        }
        
        await DbAdapter.destroy(Favorite, { where: { id: DbAdapter.getId(existing) } });
        
        const newCount = Math.max(0, (post.collection_count || 0) - 1);
        await DbAdapter.update(Post, 
            { collection_count: newCount },
            { where: { id: DbAdapter.getId(post) } }
        );
        
        return successResponse(res, { collection_count: newCount, favorited: false }, '已取消收藏');
    } catch (error) {
        console.error('取消收藏错误:', error);
        return errorResponse(res, '取消收藏失败', 500);
    }
}

/**
 * 获取我的帖子
 */
async function getMyPosts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        
        const { count, rows } = await DbAdapter.findAndCountAll(Post, {
            where: { user_id: DbAdapter.getId(req.user) },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows.map(normalizePostOutput), count, page, pageSize);
    } catch (error) {
        console.error('获取我的帖子错误:', error);
        return errorResponse(res, '获取我的帖子失败', 500);
    }
}

module.exports = {
    createPost,
    getPosts,
    getPostDetail,
    updatePost,
    deletePost,
    likePost,
    favoritePost,
    unfavoritePost,
    getMyPosts
};

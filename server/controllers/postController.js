const DbAdapter = require('../utils/dbAdapter');
/**
 * 社区帖子控制器
 */

const { Post, User, Comment, Like, Favorite, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { Op } = require('sequelize');

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
            user_id: req.user.id,
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
            where[Op.or] = [
                { title: { [Op.like]: `%${keyword}%` } },
                { content: { [Op.like]: `%${keyword}%` } }
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
        
        return paginateResponse(res, rows, count, page, pageSize);
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
        
        await DbAdapter.update(Post, 
            { view_count: (post.view_count || 0) + 1 },
            { where: { id: DbAdapter.getId(post) } }
        );
        
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
        
        return successResponse(res, { ...post.toJSON(), comments });
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
        
        if (post.user_id !== req.user.id) {
            return errorResponse(res, '无权修改此帖子', 403);
        }
        
        await DbAdapter.update(Post, {
            title: title || post.title,
            content: content || post.content,
            category: category || post.category,
            tags: tags !== undefined ? tags : post.tags,
            cover: cover || post.cover
        }, { where: { id } });
        
        return successResponse(res, post, '帖子已更新');
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
        
        if (post.user_id !== req.user.id && req.user.role !== 'admin') {
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
 * 点赞帖子（支持取消）
 */
async function likePost(req, res) {
    try {
        const { id } = req.params;

        const post = await DbAdapter.findByPk(Post, id);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }

        const existing = await DbAdapter.findOne(Like, {
            where: { user_id: req.user.id, post_id: id }
        });

        if (existing) {
            await DbAdapter.destroy(Like, { where: { id: DbAdapter.getId(existing) } });
            await DbAdapter.decrement(post, 'like_count');
            const updatedPost = await DbAdapter.findByPk(Post, DbAdapter.getId(post), { attributes: ['like_count'] });
            return successResponse(res, { like_count: Math.max(0, updatedPost.like_count), liked: false }, '已取消点赞');
        }

        await DbAdapter.create(Like, {
            user_id: req.user.id,
            post_id: DbAdapter.getId(post)
        });
        await DbAdapter.increment(post, 'like_count');
        const updatedPost = await DbAdapter.findByPk(Post, DbAdapter.getId(post), { attributes: ['like_count'] });

        return successResponse(res, { like_count: updatedPost.like_count, liked: true }, '点赞成功');
    } catch (error) {
        console.error('点赞错误:', error);
        return errorResponse(res, '点赞失败', 500);
    }
}

/**
 * 收藏帖子（支持取消）
 */
async function favoritePost(req, res) {
    try {
        const { id } = req.params;

        const post = await DbAdapter.findByPk(Post, id);
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }

        const existing = await DbAdapter.findOne(Favorite, {
            where: { user_id: req.user.id, post_id: id }
        });

        if (existing) {
            await DbAdapter.destroy(Favorite, { where: { id: DbAdapter.getId(existing) } });
            await DbAdapter.decrement(post, 'collection_count');
            const updatedPost = await DbAdapter.findByPk(Post, DbAdapter.getId(post), { attributes: ['collection_count'] });
            return successResponse(res, { collection_count: Math.max(0, updatedPost.collection_count), favorited: false }, '已取消收藏');
        }

        await DbAdapter.create(Favorite, {
            user_id: req.user.id,
            post_id: DbAdapter.getId(post)
        });
        await DbAdapter.increment(post, 'collection_count');
        const updatedPost = await DbAdapter.findByPk(Post, DbAdapter.getId(post), { attributes: ['collection_count'] });

        return successResponse(res, { collection_count: updatedPost.collection_count, favorited: true }, '收藏成功');
    } catch (error) {
        console.error('收藏错误:', error);
        return errorResponse(res, '收藏失败', 500);
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
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
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
    getMyPosts
};

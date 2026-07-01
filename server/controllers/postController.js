const DbAdapter = require('../utils/dbAdapter');
/**
 * 社区帖子控制器
 */

const { Post, User, Comment, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { Op } = require('sequelize');
const { isRoleAtLeast } = require('../config/permissions');
const { likeContains } = require('../utils/security');
// H12: 引入内容审核服务，落库前做敏感词检查
const aiReview = require('../services/aiReview');

function canInteractWithPost(post) {
    return post && post.status === 'published';
}

/**
 * 校验 tags 参数：必须是数组、元素个数不超过 20、每个元素为长度 <= 30 的字符串。
 * 防止攻击者发送庞大嵌套数组触发 JSON.stringify OOM 崩溃。
 */
function validateTags(tags) {
    if (tags === undefined || tags === null) return null; // 不传则跳过
    if (!Array.isArray(tags)) return 'tags 必须为数组';
    if (tags.length > 20) return '标签数量不能超过 20 个';
    for (const tag of tags) {
        if (typeof tag !== 'string') return '每个标签必须是字符串';
        if (tag.length > 30) return '单个标签不能超过 30 字';
    }
    return null;
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
        
        // 修复: null/undefined 先拦截,避免 String(null)=="null" 绕过校验
        if (title == null || content == null || !String(title).trim() || !String(content).trim()) {
            return errorResponse(res, '请填写标题和内容', 400);
        }

        if (String(title).length > 200) {
            return errorResponse(res, '标题不能超过200字', 400);
        }

        if (String(content).length > 50000) {
            return errorResponse(res, '内容不能超过50000字', 400);
        }

        // OOM 防御: 校验 tags 数组长度/深度,防止恶意嵌套数组打爆 JSON.stringify
        const tagsError = validateTags(tags);
        if (tagsError) {
            return errorResponse(res, tagsError, 400);
        }

        // H12: 落库前审核标题+内容（敏感词/违规检查）
        // fallbackReview 返回 recommendation: pass / review / delete
        const reviewResult = await aiReview.fallbackReview(`${title}\n${content}`);
        if (reviewResult.recommendation === 'delete') {
            return errorResponse(res, `内容包含违规信息:${reviewResult.reason}`, 400);
        }
        // Post 模型 status 无 pending 枚举，用 hidden 表示待人工复核
        // 关键: review→hidden 时必须设置 hidden_reason='ai_review',
        // 否则 updatePost 的恢复条件(status==='hidden' && hidden_reason==='ai_review')永远不满足
        const postStatus = reviewResult.recommendation === 'review' ? 'hidden' : 'published';
        const postHiddenReason = postStatus === 'hidden' ? 'ai_review' : null;

        const post = await DbAdapter.create(Post, {
            title,
            content,
            user_id: DbAdapter.getId(req.user),
            category: category || 'discussion',
            tags,
            cover,
            status: postStatus,
            hidden_reason: postHiddenReason
        });
        
        const result = await DbAdapter.findByPk(Post, post.id, {
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
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
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
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
            const keywordWhere = likeContains(sequelize, ['title', 'content'], keyword);
            if (keywordWhere) Object.assign(where, keywordWhere);
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
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }],
            order,
            limit: pageSize,
            offset
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
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio']
            }]
        });
        
        if (!post) {
            return errorResponse(res, '帖子不存在', 404);
        }
        
        if (post.status !== 'published') {
            return errorResponse(res, '帖子不存在', 404);
        }

        // 基于会话的浏览数去重，同一会话短时间内不重复计数
        const viewKey = `post_view_${id}`;
        const sessionViews = (req.session && req.session.postViews) || {};
        const now = Date.now();
        const lastView = sessionViews[viewKey];
        const VIEW_COOLDOWN = 5 * 60 * 1000; // 5分钟内不重复计数

        let viewIncremented = false;
        if (!lastView || (now - lastView) > VIEW_COOLDOWN) {
            // 原子 +1 避免 read-modify-write 竞态
            await DbAdapter.increment(post, 'view_count');
            // M17: reload 使实例 view_count 与数据库一致，避免下方手动 +1 不准
            await post.reload();
            if (req.session) {
                if (!req.session.postViews) req.session.postViews = {};
                req.session.postViews[viewKey] = now;
            }
            viewIncremented = true;
        }

        const { Like, Favorite } = require('../models');

        let liked = false;
        let favorited = false;
        if (req.user) {
            const [existingLike, existingFav] = await Promise.all([
                DbAdapter.findOne(Like, { where: { user_id: DbAdapter.getId(req.user), post_id: DbAdapter.getId(post) } }),
                DbAdapter.findOne(Favorite, { where: { user_id: DbAdapter.getId(req.user), post_id: DbAdapter.getId(post) } })
            ]);
            liked = !!existingLike;
            favorited = !!existingFav;
        }

        // 评论分页：使用 parsePagination 控制评论加载量,避免大帖卡死/超慢
        const { page: commentPage, pageSize: commentPageSize, offset: commentOffset } = DbAdapter.parsePagination(req.query);

        // 独立 count 查询避免 include(JOIN) 导致 count 不准;
        // findAndCountAll + distinct 在 include 带 separate 时可能忽略 distinct 导致计数虚高
        const [totalComments, comments] = await Promise.all([
            DbAdapter.count(Comment, { where: { post_id: id, status: 'active', parent_id: null } }),
            DbAdapter.findAll(Comment, {
                where: { post_id: id, status: 'active', parent_id: null },
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
                }, {
                    model: Comment,
                    as: 'replies',
                    where: { status: 'active' },
                    required: false,
                    separate: true,
                    limit: 20,
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
                    }, {
                        model: User,
                        as: 'reply_to_user',
                        attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar'],
                        required: false
                    }]
                }],
                order: [['created_at', 'DESC']],
                limit: commentPageSize,
                offset: commentOffset
            })
        ]);

        // 先将评论及回复转换为普通 JSON 对象，否则给 Sequelize 实例挂 liked
        // 不会进入响应（实例的 toJSON 只输出 dataValues）
        const commentsJson = comments.map(c => {
            const json = c.toJSON ? c.toJSON() : c;
            if (Array.isArray(json.replies)) {
                json.replies = json.replies.map(r => (r && r.toJSON ? r.toJSON() : r));
            }
            return json;
        });

        // M17: 去掉无条件 +1，直接使用 reload 后的实际 view_count（冷却期内不重复计数）
        const postJson = normalizePostOutput({ ...post.toJSON(), comments: commentsJson, liked, favorited });

        const commentIds = commentsJson.flatMap(c => [
            c.id,
            ...(c.replies || []).map(r => r.id)
        ]);
        if (req.user && commentIds.length > 0) {
            const likedRows = await DbAdapter.findAll(Like, {
                where: { user_id: DbAdapter.getId(req.user), comment_id: { [Op.in]: commentIds } }
            });
            const likedSet = new Set(likedRows.map(l => String(l.comment_id)));
            if (postJson.comments) {
                postJson.comments.forEach(c => {
                    c.liked = likedSet.has(String(c.id));
                    if (c.replies) c.replies.forEach(r => { r.liked = likedSet.has(String(r.id)); });
                });
            }
        }

        // 评论分页信息
        postJson.commentPagination = {
            page: commentPage,
            pageSize: commentPageSize,
            total: totalComments
        };

        return successResponse(res, postJson);
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

        // 修复: 明确拒绝 title/content 为 null,避免 String(null) 写入 "null" 脏数据
        // 空字符串视为有效输入(允许清空),但空标题/空正文 trim 后为空需返回 400
        if (title === null) {
            return errorResponse(res, '标题不能为空', 400);
        }
        if (content === null) {
            return errorResponse(res, '内容不能为空', 400);
        }
        if (title != null) {
            const trimmedTitle = String(title).trim();
            if (trimmedTitle.length === 0) {
                return errorResponse(res, '标题不能为空', 400);
            }
            if (trimmedTitle.length > 200) {
                return errorResponse(res, '标题不能超过200字', 400);
            }
        }
        if (content != null) {
            const trimmedContent = String(content).trim();
            if (trimmedContent.length === 0) {
                return errorResponse(res, '内容不能为空', 400);
            }
            if (trimmedContent.length > 50000) {
                return errorResponse(res, '内容不能超过50000字', 400);
            }
        }

        // OOM 防御: 校验 tags 数组长度/深度
        const tagsError = validateTags(tags);
        if (tagsError) {
            return errorResponse(res, tagsError, 400);
        }

        // 计算最终落库的标题和正文(传入用新值,未传入用旧值),统一 trim 后入库避免纯空格
        let finalTitle = title !== undefined ? (title === null ? null : String(title).trim()) : post.title;
        let finalContent = content !== undefined ? (content === null ? null : String(content).trim()) : post.content;

        // 统一构建 updateData:全部字段用 !== undefined 判断,避免 falsy 判断忽略空字符串
        const updateData = {
            title: finalTitle,
            content: finalContent,
            category: category !== undefined ? category : post.category,
            tags: tags !== undefined ? tags : post.tags,
            cover: cover !== undefined ? cover : post.cover
        };

        if (title !== undefined || content !== undefined) {
            const reviewResult = await aiReview.fallbackReview(`${(finalTitle || '')}\n${(finalContent || '')}`);
            if (reviewResult.recommendation === 'delete') {
                return errorResponse(res, `内容包含违规信息:${reviewResult.reason}`, 400);
            }
            if (reviewResult.recommendation === 'review') {
                updateData.status = 'hidden';
                // 中·绕过隐藏: 加 hidden_reason='ai_review',审核 pass 时仅恢复 ai 隐藏的帖子
                updateData.hidden_reason = 'ai_review';
            } else {
                // 审核通过(pass): 仅恢复因 AI 审核被 hidden 的帖子,不复活管理员手动隐藏的帖子
                if (post.status === 'hidden' && post.hidden_reason === 'ai_review') {
                    updateData.status = 'published';
                    updateData.hidden_reason = null;
                }
            }
        }

        await DbAdapter.update(Post, updateData, { where: { id } });

        const updatedPost = await DbAdapter.findByPk(Post, id, {
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
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

        const pid = DbAdapter.getId(post);
        // L5: 删除帖子涉及多表关联数据，必须用事务包裹；Like/Favorite 无 status 字段保留物理删，Comment/Post 软删保留历史
        const { Like, Favorite, Comment, Notification } = require('../models');
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(Notification, { where: { related_id: pid, related_type: 'post' }, transaction: t });
            await DbAdapter.destroy(Like, { where: { post_id: pid }, transaction: t });
            await DbAdapter.destroy(Favorite, { where: { post_id: pid }, transaction: t });
            // Comment 有 status 字段，改为软删避免数据丢失
            await DbAdapter.update(Comment, { status: 'deleted' }, { where: { post_id: pid }, transaction: t });
            // 软删帖子并清零计数字段，保持与关联数据一致
            await DbAdapter.update(Post, { status: 'deleted', like_count: 0, collection_count: 0, comment_count: 0 }, { where: { id: pid }, transaction: t });
        });
        
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
            // 修复: destroy Like + decrement like_count 用事务包裹,保证一致性
            // 不再用旧实例 like_count > 0 判断,改用原子 decrement 带 where 条件避免负数
            await sequelize.transaction(async (t) => {
                const removed = await DbAdapter.destroy(Like, {
                    where: { id: DbAdapter.getId(existingLike) },
                    transaction: t
                });
                if (removed) {
                    // 原子 decrement: 仅当 like_count > 0 时才执行减 1,避免并发导致负数
                    await DbAdapter.decrement(post, 'like_count', {
                        where: { like_count: { [Op.gt]: 0 } },
                        transaction: t
                    });
                }
            });
            await post.reload();
            const newCount = Math.max(0, post.like_count || 0);
            return successResponse(res, { like_count: newCount, liked: false }, '已取消点赞');
        }

        // 修复: create Like + increment like_count 用事务包裹,中途失败回滚避免不一致
        try {
            await sequelize.transaction(async (t) => {
                await DbAdapter.create(Like, {
                    user_id: userId,
                    post_id: DbAdapter.getId(post)
                }, { transaction: t });
                await DbAdapter.increment(post, 'like_count', { transaction: t });
            });
        } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
                return errorResponse(res, '已经点赞过了', 400);
            }
            throw createError;
        }

        await post.reload();

        // 通知帖子作者（与 work like 行为保持一致）
        if (post.user_id != null && String(post.user_id) !== String(userId)) {
            try {
                const { Notification } = require('../models');
                // L2: 避免重复点赞发送多条通知，已有同类通知则跳过
                const existingNotify = await DbAdapter.findOne(Notification, {
                    where: {
                        user_id: post.user_id,
                        type: 'like',
                        related_id: DbAdapter.getId(post),
                        related_type: 'post',
                        sender_id: userId
                    }
                });
                if (!existingNotify) {
                    await DbAdapter.create(Notification, {
                        user_id: post.user_id,
                        type: 'like',
                        title: '点赞了你的帖子',
                        content: post.title,
                        related_id: DbAdapter.getId(post),
                        related_type: 'post',
                        sender_id: userId
                    });
                }
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

        // 修复(报告1 #4): create Favorite + increment collection_count 用事务包裹,中途失败回滚避免不一致
        try {
            await sequelize.transaction(async (t) => {
                await DbAdapter.create(Favorite, {
                    user_id: userId,
                    post_id: DbAdapter.getId(post)
                }, { transaction: t });
                await DbAdapter.increment(post, 'collection_count', { transaction: t });
            });
        } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
                return errorResponse(res, '已收藏该帖子', 400);
            }
            throw createError;
        }

        await post.reload();

        return successResponse(res, { collection_count: post.collection_count || 0, favorited: true }, '收藏成功');
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

        // 修复(报告1 #4/#5): destroy Favorite + decrement collection_count 用事务包裹,保证一致性
        // 不再用旧实例 collection_count > 0 判断,改用原子 decrement 带 where 条件避免负数
        await sequelize.transaction(async (t) => {
            const removed = await DbAdapter.destroy(Favorite, {
                where: { id: DbAdapter.getId(existing) },
                transaction: t
            });
            if (removed) {
                // 原子 decrement: 仅当 collection_count > 0 时才执行减 1,避免并发导致负数
                await DbAdapter.decrement(post, 'collection_count', {
                    where: { collection_count: { [Op.gt]: 0 } },
                    transaction: t
                });
            }
        });
        await post.reload();
        const newCount = Math.max(0, post.collection_count || 0);

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
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);

        // 过滤 deleted/hidden,"我的帖子"不显示已删除/审核隐藏的帖子
        const { count, rows } = await DbAdapter.findAndCountAll(Post, {
            where: { user_id: DbAdapter.getId(req.user), status: { [Op.ne]: 'deleted' } },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset
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

const DbAdapter = require('../utils/dbAdapter');
const { Comment, User, Work, Post, Notification } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const { isRoleAtLeast } = require('../config/permissions');

function sameId(a, b) {
    return String(a) === String(b);
}

/**
 * 通过本地主键查找已发布作品
 * 注意：comment.work_id 是本地主键，与"通过编程猫 ID 查找"的工具分开
 */
async function resolvePublishedWorkByLocalId(workId) {
    if (!workId) return null;
    const work = await DbAdapter.findByPk(Work, workId);
    return work && work.status === 'published' ? work : null;
}

async function resolvePublishedWork(workId) {
    if (workId == null || workId === '') return null;
    // 前端统一使用编程猫作品 ID，因此优先按 codemao_work_id 精确匹配；
    // 仅当查不到且入参为纯数字时，才回退按本地主键查找（兼容历史调用）。
    let work = await DbAdapter.findOne(Work, { where: { codemao_work_id: String(workId) } });
    if (!work && /^\d+$/.test(String(workId))) {
        work = await DbAdapter.findByPk(Work, workId);
    }
    return work && work.status === 'published' ? work : null;
}

async function resolvePublishedPost(postId) {
    const post = await DbAdapter.findByPk(Post, postId);
    return post && post.status === 'published' ? post : null;
}

async function createComment(req, res) {
    try {
        const { content, work_id, post_id, parent_id, reply_to_user_id } = req.body;

        if (!content || !String(content).trim()) {
            return errorResponse(res, '请输入评论内容', 400);
        }

        if (String(content).length > 2000) {
            return errorResponse(res, '评论内容不能超过2000字', 400);
        }

        const hasWorkTarget = work_id !== undefined && work_id !== null && work_id !== '';
        const hasPostTarget = post_id !== undefined && post_id !== null && post_id !== '';
        if (hasWorkTarget === hasPostTarget) {
            return errorResponse(res, '请选择一个评论目标', 400);
        }

        const work = hasWorkTarget ? await resolvePublishedWork(work_id) : null;
        const post = hasPostTarget ? await resolvePublishedPost(post_id) : null;
        if ((hasWorkTarget && !work) || (hasPostTarget && !post)) {
            return errorResponse(res, 'Comment target not found', 404);
        }

        const localWorkId = work ? DbAdapter.getId(work) : null;
        const localPostId = post ? DbAdapter.getId(post) : null;
        let replyToUserId = reply_to_user_id || null;

        if (parent_id) {
            const parent = await DbAdapter.findByPk(Comment, parent_id);
            const parentMatchesTarget = parent
                && parent.status === 'active'
                && sameId(parent.work_id || '', localWorkId || '')
                && sameId(parent.post_id || '', localPostId || '');

            if (!parentMatchesTarget) {
                return errorResponse(res, 'Parent comment not found', 404);
            }
            replyToUserId = replyToUserId || parent.user_id;
        }

        const comment = await DbAdapter.create(Comment, {
            content: String(content).trim(),
            user_id: DbAdapter.getId(req.user),
            work_id: localWorkId,
            post_id: localPostId,
            parent_id: parent_id || null,
            reply_to_user_id: replyToUserId,
            status: 'active'
        });

        if (work) {
            // 仅顶层评论（无 parent_id）才递增 comment_count，与前端保持一致
            if (!parent_id) {
                await DbAdapter.increment(work, 'comment_count');
            }
            if (work.user_id != null && !sameId(work.user_id, DbAdapter.getId(req.user))) {
                try {
                    await DbAdapter.create(Notification, {
                        user_id: work.user_id,
                        type: 'comment',
                        title: '评论了你的作品',
                        content: String(content).substring(0, 100),
                        related_id: localWorkId,
                        related_type: 'work',
                        sender_id: DbAdapter.getId(req.user)
                    });
                } catch (e) { console.error('创建评论通知失败:', e.message); }
            }
        }

        if (post) {
            // 仅顶层评论（无 parent_id）才递增 comment_count，与前端保持一致
            if (!parent_id) {
                await DbAdapter.increment(post, 'comment_count');
            }
            if (!sameId(post.user_id, DbAdapter.getId(req.user))) {
                try {
                    await DbAdapter.create(Notification, {
                        user_id: post.user_id,
                        type: 'comment',
                        title: '评论了你的帖子',
                        content: String(content).substring(0, 100),
                        related_id: localPostId,
                        related_type: 'post',
                        sender_id: DbAdapter.getId(req.user)
                    });
                } catch (e) { console.error('创建评论通知失败:', e.message); }
            }
        }

        if (parent_id && replyToUserId && !sameId(replyToUserId, DbAdapter.getId(req.user))) {
            try {
                await DbAdapter.create(Notification, {
                    user_id: replyToUserId,
                    type: 'reply',
                    title: '回复了你的评论',
                    content: String(content).substring(0, 100),
                    related_id: localWorkId || localPostId,
                    related_type: localWorkId ? 'work' : 'post',
                    sender_id: DbAdapter.getId(req.user)
                });
            } catch (e) { console.error('创建回复通知失败:', e.message); }
        }

        const result = await DbAdapter.findByPk(Comment, DbAdapter.getId(comment), {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }, {
                model: User,
                as: 'reply_to_user',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname'],
                required: false
            }]
        });

        return successResponse(res, result, '评论成功');
    } catch (error) {
        console.error('Create comment error:', error);
        return errorResponse(res, 'Failed to create comment', 500);
    }
}

async function getWorkComments(req, res) {
    try {
        const { workId } = req.params;
        const page = parseInt(req.query.page, 10) || 1;
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
        const work = await resolvePublishedWork(workId);

        if (!work) {
            return successResponse(res, { list: [], total: 0 });
        }

        const { count, rows } = await DbAdapter.findAndCountAll(Comment, {
            where: { work_id: DbAdapter.getId(work), status: 'active', parent_id: null },
            distinct: true,
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }, {
                model: User,
                as: 'reply_to_user',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname'],
                required: false
            }, {
                model: Comment,
                as: 'replies',
                where: { status: 'active' },
                required: false,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'nickname', 'avatar']
                }, {
                    model: User,
                    as: 'reply_to_user',
                    attributes: ['id', 'codemao_user_id', 'username', 'nickname'],
                    required: false
                }]
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        const { Like } = require('../models');
        const { Op } = require('sequelize');

        const commentIds = rows.flatMap(c => [
            DbAdapter.getId(c),
            ...(c.replies || []).map(r => DbAdapter.getId(r))
        ]);

        let likedSet = new Set();
        if (req.user && commentIds.length > 0) {
            const likedRows = await DbAdapter.findAll(Like, {
                where: { user_id: DbAdapter.getId(req.user), comment_id: { [Op.in]: commentIds } }
            });
            likedSet = new Set(likedRows.map(l => String(l.comment_id)));
        }

        const list = rows.map(c => {
            const json = c.toJSON ? c.toJSON() : c;
            json.liked = likedSet.has(String(json.id));
            if (json.replies) json.replies.forEach(r => { r.liked = likedSet.has(String(r.id)); });
            return json;
        });

        return successResponse(res, { list, total: count });
    } catch (error) {
        console.error('Get comments error:', error);
        return errorResponse(res, 'Failed to get comments', 500);
    }
}

async function deleteComment(req, res) {
    try {
        const { id } = req.params;
        const comment = await DbAdapter.findByPk(Comment, id);

        if (!comment) {
            return errorResponse(res, '评论不存在', 404);
        }

        if (!sameId(comment.user_id, DbAdapter.getId(req.user)) && !isRoleAtLeast(req.user.role, 'moderator')) {
            return errorResponse(res, '无权删除此评论', 403);
        }

        if (comment.status === 'deleted') {
            return successResponse(res, null, '评论已删除');
        }

        await DbAdapter.update(Comment, { status: 'deleted' }, { where: { id } });

        // 级联软删除子回复，避免孤儿回复
        await DbAdapter.update(Comment, { status: 'deleted' }, { where: { parent_id: id } });

        // 仅顶层评论（无 parent_id）才递减 comment_count，与 createComment 保持一致
        if (!comment.parent_id) {
            if (comment.work_id) {
                const work = await DbAdapter.findByPk(Work, comment.work_id);
                if (work && (work.comment_count || 0) > 0) await DbAdapter.decrement(work, 'comment_count');
            }
            if (comment.post_id) {
                const post = await DbAdapter.findByPk(Post, comment.post_id);
                if (post && (post.comment_count || 0) > 0) await DbAdapter.decrement(post, 'comment_count');
            }
        }

        return successResponse(res, null, '评论已删除');
    } catch (error) {
        console.error('删除评论错误:', error);
        return errorResponse(res, '删除评论失败', 500);
    }
}

async function likeComment(req, res) {
    try {
        const { id } = req.params;
        const userId = DbAdapter.getId(req.user);
        const comment = await DbAdapter.findByPk(Comment, id);

        if (!comment || comment.status !== 'active') {
            return errorResponse(res, '评论不存在', 404);
        }
        if (comment.work_id && !await resolvePublishedWorkByLocalId(comment.work_id)) {
            return errorResponse(res, '评论不存在', 404);
        }
        if (comment.post_id && !await resolvePublishedPost(comment.post_id)) {
            return errorResponse(res, '评论不存在', 404);
        }

        const { Like } = require('../models');
        const existing = await DbAdapter.findOne(Like, {
            where: { user_id: userId, comment_id: DbAdapter.getId(comment) }
        });

        if (existing) {
            // 已点赞 → 取消点赞（toggle）
            const removed = await DbAdapter.destroy(Like, { where: { id: DbAdapter.getId(existing) } });
            if (removed && (comment.like_count || 0) > 0) {
                await DbAdapter.decrement(comment, 'like_count');
            }
            await comment.reload();
            const newCount = Math.max(0, comment.like_count || 0);
            return successResponse(res, { like_count: newCount, liked: false }, '已取消点赞');
        }

        try {
            await DbAdapter.create(Like, {
                user_id: userId,
                comment_id: DbAdapter.getId(comment)
            });
        } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
                return errorResponse(res, '已经点赞过了', 400);
            }
            throw createError;
        }

        await DbAdapter.increment(comment, 'like_count');
        await comment.reload();

        const likeCount = Math.max(0, comment.like_count || 0);
        return successResponse(res, { like_count: likeCount, liked: true }, '点赞成功');
    } catch (error) {
        console.error('点赞评论错误:', error);
        return errorResponse(res, '点赞失败', 500);
    }
}

module.exports = {
    createComment,
    getWorkComments,
    deleteComment,
    likeComment
};

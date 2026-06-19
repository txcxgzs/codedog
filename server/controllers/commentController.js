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
    let work = null;
    if (Number.isNaN(Number(workId)) || String(workId).length > 10) {
        work = await DbAdapter.findOne(Work, { where: { codemao_work_id: String(workId) } });
    } else {
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
            return errorResponse(res, 'Please enter comment content', 400);
        }

        const hasWorkTarget = work_id !== undefined && work_id !== null && work_id !== '';
        const hasPostTarget = post_id !== undefined && post_id !== null && post_id !== '';
        if (hasWorkTarget === hasPostTarget) {
            return errorResponse(res, 'Please choose exactly one comment target', 400);
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
                await DbAdapter.create(Notification, {
                    user_id: work.user_id,
                    type: 'comment',
                    title: 'New work comment',
                    content: String(content).substring(0, 100),
                    related_id: localWorkId,
                    related_type: 'work',
                    sender_id: DbAdapter.getId(req.user)
                });
            }
        }

        if (post) {
            // 仅顶层评论（无 parent_id）才递增 comment_count，与前端保持一致
            if (!parent_id) {
                await DbAdapter.increment(post, 'comment_count');
            }
            if (!sameId(post.user_id, DbAdapter.getId(req.user))) {
                await DbAdapter.create(Notification, {
                    user_id: post.user_id,
                    type: 'comment',
                    title: 'New post comment',
                    content: String(content).substring(0, 100),
                    related_id: localPostId,
                    related_type: 'post',
                    sender_id: DbAdapter.getId(req.user)
                });
            }
        }

        if (parent_id && replyToUserId && !sameId(replyToUserId, DbAdapter.getId(req.user))) {
            await DbAdapter.create(Notification, {
                user_id: replyToUserId,
                type: 'reply',
                title: 'New comment reply',
                content: String(content).substring(0, 100),
                related_id: localWorkId || localPostId,
                related_type: localWorkId ? 'work' : 'post',
                sender_id: DbAdapter.getId(req.user)
            });
        }

        const result = await DbAdapter.findByPk(Comment, DbAdapter.getId(comment), {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }, {
                model: User,
                as: 'reply_to_user',
                attributes: ['id', 'username', 'nickname'],
                required: false
            }]
        });

        return successResponse(res, result, 'Comment created');
    } catch (error) {
        console.error('Create comment error:', error);
        return errorResponse(res, 'Failed to create comment', 500);
    }
}

async function getWorkComments(req, res) {
    try {
        const { workId } = req.params;
        const page = parseInt(req.query.page, 10) || 1;
        const pageSize = parseInt(req.query.pageSize, 10) || 20;
        const work = await resolvePublishedWork(workId);

        if (!work) {
            return successResponse(res, { list: [], total: 0 });
        }

        const { count, rows } = await DbAdapter.findAndCountAll(Comment, {
            where: { work_id: DbAdapter.getId(work), status: 'active', parent_id: null },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }, {
                model: User,
                as: 'reply_to_user',
                attributes: ['id', 'username', 'nickname'],
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
                    attributes: ['id', 'username', 'nickname'],
                    required: false
                }]
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        return successResponse(res, { list: rows, total: count });
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
            return errorResponse(res, 'Comment not found', 404);
        }

        if (!sameId(comment.user_id, DbAdapter.getId(req.user)) && !isRoleAtLeast(req.user.role, 'moderator')) {
            return errorResponse(res, 'No permission to delete this comment', 403);
        }

        await DbAdapter.update(Comment, { status: 'deleted' }, { where: { id } });

        // 仅顶层评论（无 parent_id）才递减 comment_count，与 createComment 保持一致
        if (!comment.parent_id) {
            if (comment.work_id) {
                const work = await DbAdapter.findByPk(Work, comment.work_id);
                if (work) await DbAdapter.decrement(work, 'comment_count');
            }
            if (comment.post_id) {
                const post = await DbAdapter.findByPk(Post, comment.post_id);
                if (post) await DbAdapter.decrement(post, 'comment_count');
            }
        }

        return successResponse(res, null, 'Comment deleted');
    } catch (error) {
        console.error('Delete comment error:', error);
        return errorResponse(res, 'Failed to delete comment', 500);
    }
}

async function likeComment(req, res) {
    try {
        const { id } = req.params;
        const userId = DbAdapter.getId(req.user);
        const comment = await DbAdapter.findByPk(Comment, id);

        if (!comment || comment.status !== 'active') {
            return errorResponse(res, 'Comment not found', 404);
        }
        if (comment.work_id && !await resolvePublishedWorkByLocalId(comment.work_id)) {
            return errorResponse(res, 'Comment not found', 404);
        }
        if (comment.post_id && !await resolvePublishedPost(comment.post_id)) {
            return errorResponse(res, 'Comment not found', 404);
        }

        const { Like } = require('../models');
        const existing = await DbAdapter.findOne(Like, {
            where: { user_id: userId, comment_id: DbAdapter.getId(comment) }
        });

        if (existing) {
            // 已点赞 → 取消点赞（toggle）
            await DbAdapter.destroy(Like, { where: { id: DbAdapter.getId(existing) } });
            const newCount = Math.max(0, (comment.like_count || 0) - 1);
            await DbAdapter.update(Comment, { like_count: newCount }, { where: { id: DbAdapter.getId(comment) } });
            return successResponse(res, { like_count: newCount, liked: false }, 'Unliked');
        }

        await DbAdapter.create(Like, {
            user_id: userId,
            comment_id: DbAdapter.getId(comment)
        });

        const likeCount = (comment.like_count || 0) + 1;
        await DbAdapter.update(Comment, { like_count: likeCount }, { where: { id: DbAdapter.getId(comment) } });

        return successResponse(res, { like_count: likeCount, liked: true }, 'Liked');
    } catch (error) {
        console.error('Like comment error:', error);
        return errorResponse(res, 'Failed to like comment', 500);
    }
}

module.exports = {
    createComment,
    getWorkComments,
    deleteComment,
    likeComment
};

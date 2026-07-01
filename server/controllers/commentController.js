const DbAdapter = require('../utils/dbAdapter');
const { Comment, User, Work, Post, Notification, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { isRoleAtLeast } = require('../config/permissions');
// H12: 引入内容审核服务，落库前做敏感词检查
const aiReview = require('../services/aiReview');

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
            // M18: 仅允许回复顶层评论，禁止对子回复再回复，避免层级过深
            if (parent.parent_id != null) {
                return errorResponse(res, '只能回复顶层评论', 400);
            }
            replyToUserId = replyToUserId || parent.user_id;
        }

        // H12: 落库前进行内容审核（敏感词/违规检查）
        // fallbackReview 返回 recommendation: pass / review / delete
        // delete 表示严重违规应拒绝，review 表示需人工复核，pass 表示通过
        const reviewResult = await aiReview.fallbackReview(String(content));
        if (reviewResult.recommendation === 'delete') {
            return errorResponse(res, `内容包含违规信息:${reviewResult.reason}`, 400);
        }
        // Comment 模型 status 无 pending 枚举，用 hidden 表示待人工复核
        const commentStatus = reviewResult.recommendation === 'review' ? 'hidden' : 'active';

        // 修复: 评论落库、计数递增、通知创建均放入同一事务,任一失败整体回滚避免数据漂移
        // 通知创建不再 try/catch 吞错,让其抛出回滚事务（与 createComment 同生共死）
        let comment;
        const isVisible = commentStatus === 'active';
        await sequelize.transaction(async (t) => {
            comment = await DbAdapter.create(Comment, {
                content: String(content).trim(),
                user_id: DbAdapter.getId(req.user),
                work_id: localWorkId,
                post_id: localPostId,
                parent_id: parent_id || null,
                reply_to_user_id: replyToUserId,
                status: commentStatus
            }, { transaction: t });

            if (work && isVisible) {
                // 仅顶层评论（无 parent_id）才递增 comment_count，与前端保持一致
                if (!parent_id) {
                    await DbAdapter.increment(work, 'comment_count', { transaction: t });
                }
                // 修复(低-7): 仅顶层评论才通知作品作者;回复时只通知被回复者,避免 over-notification
                if (!parent_id && work.user_id != null && !sameId(work.user_id, DbAdapter.getId(req.user))) {
                    await DbAdapter.create(Notification, {
                        user_id: work.user_id,
                        type: 'comment',
                        title: '评论了你的作品',
                        content: String(content).substring(0, 100),
                        related_id: localWorkId,
                        related_type: 'work',
                        sender_id: DbAdapter.getId(req.user)
                    }, { transaction: t });
                }
            }

            if (post && isVisible) {
                // 仅顶层评论（无 parent_id）才递增 comment_count，与前端保持一致
                if (!parent_id) {
                    await DbAdapter.increment(post, 'comment_count', { transaction: t });
                }
                // 修复(低-7): 仅顶层评论才通知帖子作者;回复时不再重复通知帖子作者
                if (!parent_id && !sameId(post.user_id, DbAdapter.getId(req.user))) {
                    await DbAdapter.create(Notification, {
                        user_id: post.user_id,
                        type: 'comment',
                        title: '评论了你的帖子',
                        content: String(content).substring(0, 100),
                        related_id: localPostId,
                        related_type: 'post',
                        sender_id: DbAdapter.getId(req.user)
                    }, { transaction: t });
                }
            }

            // 回复通知: 仅回复(有 parent_id)时发给被回复者,且避免自我通知
            if (isVisible && parent_id && replyToUserId && !sameId(replyToUserId, DbAdapter.getId(req.user))) {
                await DbAdapter.create(Notification, {
                    user_id: replyToUserId,
                    type: 'reply',
                    title: '回复了你的评论',
                    content: String(content).substring(0, 100),
                    related_id: localWorkId || localPostId,
                    related_type: localWorkId ? 'work' : 'post',
                    sender_id: DbAdapter.getId(req.user)
                }, { transaction: t });
            }
        });

        const result = await DbAdapter.findByPk(Comment, DbAdapter.getId(comment), {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
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
        // M3: 统一使用 parsePagination 限制 pageSize 上限
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const work = await resolvePublishedWork(workId);

        // L7: 作品不存在应返回 404，而非空列表
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }

        const { count, rows } = await DbAdapter.findAndCountAll(Comment, {
            where: { work_id: DbAdapter.getId(work), status: 'active', parent_id: null },
            distinct: true,
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }, {
                model: User,
                as: 'reply_to_user',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname'],
                required: false
            }, {
                // 报告4 #22: 评论回复递归深度限制
                // 此处 replies include 故意只展开一层,内部仅包含 User(replies 作者/被回复者),
                // 不再嵌套 Comment.replies,避免自引用关联导致无限递归 → 栈溢出 → 服务崩溃。
                // 业务规则: 仅允许回复顶层评论(createComment 中 parent.parent_id != null 拦截),
                // 因此最多两级(顶层评论 + 一层回复),单层 include 即可覆盖。
                model: Comment,
                as: 'replies',
                where: { status: 'active' },
                required: false,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
                }, {
                    model: User,
                    as: 'reply_to_user',
                    attributes: ['id', 'codemao_user_id', 'username', 'nickname'],
                    required: false
                }]
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: offset
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

        // L1: 统一使用 paginateResponse 返回分页结构
        return paginateResponse(res, list, count, page, pageSize);
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

        const wasActive = comment.status === 'active';
        // 修复: 删除评论涉及多表关联数据(评论软删/子回复软删/点赞清理/计数递减),必须用事务包裹
        const { Op } = require('sequelize');
        const { Like } = require('../models');
        await sequelize.transaction(async (t) => {
            await DbAdapter.update(Comment, { status: 'deleted' }, { where: { id }, transaction: t });

            // 级联软删除子回复，避免孤儿回复
            await DbAdapter.update(Comment, { status: 'deleted' }, { where: { parent_id: id }, transaction: t });

            // M20: 清理该评论及其子回复关联的点赞记录，并清零 like_count
            // 修复 bug1: 级联软删子回复时,需同时清理子回复的 Like,避免孤儿点赞
            // 查询所有 parent_id=id 的子回复 id 列表
            const childReplies = await DbAdapter.findAll(Comment, {
                where: { parent_id: id },
                attributes: ['id'],
                transaction: t
            });
            // 将父评论 id 与所有子回复 id 一起作为 comment_id 的 Op.in 条件清理 Like
            const commentIdsToClean = [id, ...childReplies.map(c => DbAdapter.getId(c))];
            // 批量清理这些评论关联的点赞记录,避免孤儿点赞
            await DbAdapter.destroy(Like, { where: { comment_id: { [Op.in]: commentIdsToClean } }, transaction: t });
            // 批量清零这些评论的 like_count,避免子回复计数残留(此前仅清了父评论,子回复 like_count 未清)
            await DbAdapter.update(Comment, { like_count: 0 }, { where: { id: { [Op.in]: commentIdsToClean } }, transaction: t });

            // 仅在旧状态为 active 且顶层评论时才递减 comment_count，避免 hidden→deleted 重复扣减
            // 修复(报告1 #9): 移除 in-memory (count > 0) 旧实例判断，改用原子条件 decrement
            // 仅当 comment_count > 0 时才执行减 1，避免并发导致负数（与 likeComment/unlikeComment 同模式）
            if (wasActive && !comment.parent_id) {
                if (comment.work_id) {
                    const work = await DbAdapter.findByPk(Work, comment.work_id, { transaction: t });
                    if (work) {
                        await DbAdapter.decrement(work, 'comment_count', {
                            where: { comment_count: { [Op.gt]: 0 } },
                            transaction: t
                        });
                    }
                }
                if (comment.post_id) {
                    const post = await DbAdapter.findByPk(Post, comment.post_id, { transaction: t });
                    if (post) {
                        await DbAdapter.decrement(post, 'comment_count', {
                            where: { comment_count: { [Op.gt]: 0 } },
                            transaction: t
                        });
                    }
                }
            }
        });

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
        const { Op } = require('sequelize');
        const existing = await DbAdapter.findOne(Like, {
            where: { user_id: userId, comment_id: DbAdapter.getId(comment) }
        });

        if (existing) {
            // 已点赞 → 取消点赞（toggle）
            // 修复 bug3: destroy Like + decrement like_count 用事务包裹,保证一致性
            // 修复 bug4: 不再用旧实例 like_count > 0 判断,改用原子 decrement 带 where 条件避免负数
            await sequelize.transaction(async (t) => {
                const removed = await DbAdapter.destroy(Like, {
                    where: { id: DbAdapter.getId(existing) },
                    transaction: t
                });
                if (removed) {
                    // 原子 decrement: 仅当 like_count > 0 时才执行减 1,避免并发导致负数
                    await DbAdapter.decrement(comment, 'like_count', {
                        where: { like_count: { [Op.gt]: 0 } },
                        transaction: t
                    });
                }
            });
            await comment.reload();
            const newCount = Math.max(0, comment.like_count || 0);
            return successResponse(res, { like_count: newCount, liked: false }, '已取消点赞');
        }

        // 修复 bug3: create Like + increment like_count 用事务包裹,中途失败回滚避免不一致
        try {
            await sequelize.transaction(async (t) => {
                await DbAdapter.create(Like, {
                    user_id: userId,
                    comment_id: DbAdapter.getId(comment)
                }, { transaction: t });
                await DbAdapter.increment(comment, 'like_count', { transaction: t });
            });
        } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
                return errorResponse(res, '已经点赞过了', 400);
            }
            throw createError;
        }

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

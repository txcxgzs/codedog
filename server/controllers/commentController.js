const DbAdapter = require('../utils/dbAdapter');
/**
 * 评论控制器
 */

const { Comment, User, Work, Post, Notification, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');

/**
 * 发表评论
 */
async function createComment(req, res) {
    try {
        const { content, work_id, post_id, parent_id, reply_to_user_id } = req.body;
        
        if (!content) {
            return errorResponse(res, '请输入评论内容', 400);
        }
        
        if (!work_id && !post_id) {
            return errorResponse(res, '评论对象不存在', 400);
        }
        
        const comment = await DbAdapter.create(Comment, {
            content,
            user_id: req.user.id,
            work_id,
            post_id,
            parent_id,
            reply_to_user_id,
            status: 'active'
        });
        
        // 更新评论数并发送通知
        if (work_id) {
            const work = await DbAdapter.findByPk(Work, work_id);
            if (work) {
                await DbAdapter.update(Work, 
                    { comment_count: (work.comment_count || 0) + 1 },
                    { where: { id: DbAdapter.getId(work) } }
                );
                if (work.user_id !== req.user.id) {
                    await DbAdapter.create(Notification, {
                        user_id: work.user_id,
                        type: 'comment',
                        title: '评论了你的作品',
                        content: content.substring(0, 100),
                        related_id: DbAdapter.getId(work),
                        related_type: 'work',
                        sender_id: req.user.id
                    });
                }
            }
        }
        if (post_id) {
            const post = await DbAdapter.findByPk(Post, post_id);
            if (post) {
                await DbAdapter.update(Post, 
                    { comment_count: (post.comment_count || 0) + 1 },
                    { where: { id: DbAdapter.getId(post) } }
                );
                if (post.user_id !== req.user.id) {
                    await DbAdapter.create(Notification, {
                        user_id: post.user_id,
                        type: 'comment',
                        title: '评论了你的帖子',
                        content: content.substring(0, 100),
                        related_id: DbAdapter.getId(post),
                        related_type: 'post',
                        sender_id: req.user.id
                    });
                }
            }
        }
        
        // 如果是回复，发送回复通知
        if (parent_id && reply_to_user_id && reply_to_user_id !== req.user.id) {
            await DbAdapter.create(Notification, {
                user_id: reply_to_user_id,
                type: 'reply',
                title: '回复了你的评论',
                content: content.substring(0, 100),
                related_id: work_id || post_id,
                related_type: work_id ? 'work' : 'post',
                sender_id: req.user.id
            });
        }
        
        const result = await DbAdapter.findByPk(Comment, DbAdapter.getId(comment), {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }]
        });
        
        return successResponse(res, result, '评论成功');
    } catch (error) {
        console.error('发表评论错误:', error);
        return errorResponse(res, '评论失败', 500);
    }
}

/**
 * 获取作品评论
 */
async function getWorkComments(req, res) {
    try {
        const { workId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        
        let localWorkId = workId;
        if (isNaN(workId) || workId.length > 10) {
            const work = await DbAdapter.findOne(Work, { where: { codemao_work_id: workId } });
            if (work) {
                localWorkId = DbAdapter.getId(work);
            } else {
                return successResponse(res, { list: [], total: 0 });
            }
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(Comment, {
            where: { work_id: localWorkId, status: 'active', parent_id: null },
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
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return successResponse(res, { list: rows, total: count });
    } catch (error) {
        console.error('获取评论错误:', error);
        return errorResponse(res, '获取评论失败', 500);
    }
}

/**
 * 删除评论
 */
async function deleteComment(req, res) {
    try {
        const { id } = req.params;
        
        const comment = await DbAdapter.findByPk(Comment, id);
        if (!comment) {
            return errorResponse(res, '评论不存在', 404);
        }
        
        if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
            return errorResponse(res, '无权删除此评论', 403);
        }
        
        await DbAdapter.update(Comment, { status: 'deleted' }, { where: { id } });
        
        if (comment.work_id) {
            const work = await DbAdapter.findByPk(Work, comment.work_id);
            if (work) {
                await DbAdapter.update(Work, 
                    { comment_count: Math.max(0, (work.comment_count || 0) - 1) },
                    { where: { id: DbAdapter.getId(work) } }
                );
            }
        }
        if (comment.post_id) {
            const post = await DbAdapter.findByPk(Post, comment.post_id);
            if (post) {
                await DbAdapter.update(Post, 
                    { comment_count: Math.max(0, (post.comment_count || 0) - 1) },
                    { where: { id: DbAdapter.getId(post) } }
                );
            }
        }
        
        return successResponse(res, null, '评论已删除');
    } catch (error) {
        console.error('删除评论错误:', error);
        return errorResponse(res, '删除评论失败', 500);
    }
}

/**
 * 点赞评论
 */
async function likeComment(req, res) {
    try {
        const { id } = req.params;
        const userId = DbAdapter.getId(req.user);
        
        const comment = await DbAdapter.findByPk(Comment, id);
        if (!comment) {
            return errorResponse(res, '评论不存在', 404);
        }
        
        const { Like } = require('../models');
        
        const existing = await DbAdapter.findOne(Like, {
            where: { user_id: userId, comment_id: DbAdapter.getId(comment) }
        });
        
        if (existing) {
            await DbAdapter.destroy(Like, { where: { id: DbAdapter.getId(existing) } });
            await DbAdapter.decrement(comment, 'like_count');
            const updatedComment = await DbAdapter.findByPk(Comment, DbAdapter.getId(comment), { attributes: ['like_count'] });
            return successResponse(res, { like_count: Math.max(0, updatedComment.like_count), liked: false }, '已取消点赞');
        }
        
        await DbAdapter.create(Like, {
            user_id: userId,
            comment_id: DbAdapter.getId(comment)
        });
        
        await DbAdapter.increment(comment, 'like_count');
        const updatedComment = await DbAdapter.findByPk(Comment, DbAdapter.getId(comment), { attributes: ['like_count'] });
        
        return successResponse(res, { like_count: updatedComment.like_count, liked: true }, '点赞成功');
    } catch (error) {
        console.error('点赞错误:', error);
        return errorResponse(res, '点赞失败', 500);
    }
}

module.exports = {
    createComment,
    getWorkComments,
    deleteComment,
    likeComment
};

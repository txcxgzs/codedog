const { Post, Comment, ForumBoardModerator } = require('../models');
const { hasPermission, isRoleAtLeast } = require('../config/permissions');
const { errorResponse } = require('./response');

function requireForumPostPermission(permission) {
    return async (req, res, next) => {
        try {
            if (!req.user) return errorResponse(res, '请先登录', 401);
            if (req.user.role === 'reviewer') return errorResponse(res, '审核员只能管理作品及作品评论', 403);
            if (req.user.role === 'superadmin') return next();
            if (isRoleAtLeast(req.user.role, 'admin')) {
                if (!hasPermission(req.user.role, permission)) return errorResponse(res, '您没有权限执行此操作', 403);
                return next();
            }
            if (req.user.role !== 'moderator') {
                if (!hasPermission(req.user.role, permission)) return errorResponse(res, '您没有权限执行此操作', 403);
                return next();
            }
            if (permission !== 'post:edit' && !hasPermission(req.user.role, permission)) {
                return errorResponse(res, '您的版主角色没有该项操作权限', 403);
            }
            if (permission === 'post:edit') {
                if (req.body?.status === 'deleted' && !hasPermission(req.user.role, 'post:delete')) return errorResponse(res, '您的版主角色没有删除帖子权限', 403);
                if ((req.body?.is_top !== undefined || req.body?.is_essence !== undefined) && !hasPermission(req.user.role, 'post:sticky')) return errorResponse(res, '您的版主角色没有置顶或加精权限', 403);
                if (req.body?.is_locked !== undefined && !hasPermission(req.user.role, 'post:lock')) return errorResponse(res, '您的版主角色没有锁定帖子权限', 403);
            }
            const post = await Post.findByPk(Number(req.params.postId), { attributes: ['id', 'board_id'] });
            if (!post) return errorResponse(res, '帖子不存在', 404);
            const assignment = await ForumBoardModerator.findOne({
                where: { board_id: post.board_id, user_id: Number(req.user.id) },
                attributes: ['id']
            });
            if (!assignment) return errorResponse(res, '您只能管理被分配板块中的帖子', 403);
            req.forumModerationPost = post;
            return next();
        } catch (error) {
            console.error('论坛分区权限检查失败:', error);
            return errorResponse(res, '论坛权限检查失败', 500);
        }
    };
}

function requireScopedCommentPermission(permission) {
    return async (req, res, next) => {
        try {
            if (!req.user || !hasPermission(req.user.role, permission)) return errorResponse(res, '您没有权限执行此操作', 403);
            if (isRoleAtLeast(req.user.role, 'admin')) return next();
            const comment = await Comment.findByPk(Number(req.params.commentId), { attributes: ['id', 'work_id', 'post_id'] });
            if (!comment) return errorResponse(res, '评论不存在', 404);
            if (req.user.role === 'reviewer') {
                if (!comment.work_id) return errorResponse(res, '审核员只能管理作品评论', 403);
                req.scopedComment = comment;
                return next();
            }
            if (req.user.role === 'moderator') {
                if (!comment.post_id) return errorResponse(res, '版主只能管理论坛帖子评论', 403);
                const post = await Post.findByPk(comment.post_id, { attributes: ['id', 'board_id'] });
                const assignment = post && await ForumBoardModerator.findOne({ where: { board_id: post.board_id, user_id: Number(req.user.id) }, attributes: ['id'] });
                if (!assignment) return errorResponse(res, '您只能管理被分配板块中的评论', 403);
                req.scopedComment = comment;
                return next();
            }
            return errorResponse(res, '您没有权限执行此操作', 403);
        } catch (error) {
            console.error('评论范围权限检查失败:', error);
            return errorResponse(res, '评论权限检查失败', 500);
        }
    };
}

module.exports = { requireForumPostPermission, requireScopedCommentPermission };

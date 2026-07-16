const { User, UserWarning, Notification, Post, Comment, ForumBoardModerator, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const { logOperation } = require('../middleware/operationLog');
const { canManageUser } = require('../config/permissions');
const DbAdapter = require('../utils/dbAdapter');

async function issueWarning(req, res) {
    try {
        const userId = Number(req.params.userId);
        const reason = String(req.body?.reason || '').trim();
        if (!Number.isSafeInteger(userId) || userId <= 0) return errorResponse(res, '无效的用户 ID', 400);
        if (reason.length < 5 || reason.length > 1000) return errorResponse(res, '警告原因需为 5-1000 字', 400);
        const target = await User.findByPk(userId);
        if (!target) return errorResponse(res, '用户不存在', 404);
        if (Number(req.user.id) === userId || !canManageUser(req.user.role, target.role)) return errorResponse(res, '不能警告同级、更高级或自己的账号', 403);
        if (req.user.role === 'moderator') {
            const sourceType = String(req.body?.source_type || '');
            const sourceId = Number(req.body?.source_id);
            let post = null;
            if (sourceType === 'post') post = await Post.findOne({ where: { id: sourceId, user_id: userId }, attributes: ['id', 'board_id'] });
            if (sourceType === 'comment') {
                const comment = await Comment.findOne({ where: { id: sourceId, user_id: userId }, attributes: ['id', 'post_id'] });
                if (comment?.post_id) post = await Post.findByPk(comment.post_id, { attributes: ['id', 'board_id'] });
            }
            const assignment = post && await ForumBoardModerator.findOne({ where: { board_id: post.board_id, user_id: Number(req.user.id) }, attributes: ['id'] });
            if (!assignment) return errorResponse(res, '版主只能警告自己负责板块中确有违规内容的作者', 403);
        }
        const warning = await sequelize.transaction(async transaction => {
            const created = await UserWarning.create({
                user_id: userId, issued_by: Number(req.user.id), reason,
                source_type: req.body?.source_type || null,
                source_id: Number(req.body?.source_id) || null
            }, { transaction });
            await Notification.create({
                user_id: userId, sender_id: Number(req.user.id), type: 'system',
                title: '违规警告：请签署保证书',
                content: `你因以下行为收到正式警告：${reason}。请进入网站阅读警告并签署不再违规保证书。`,
                related_id: created.id, related_type: 'user_warning'
            }, { transaction });
            return created;
        });
        logOperation(req, 'warn_user', 'user', userId, { warning_id: warning.id, reason });
        return successResponse(res, { id: warning.id }, '警告已发出，用户下次进入网站必须签署保证书');
    } catch (error) {
        console.error('发出用户警告失败:', error);
        return errorResponse(res, '发出警告失败', 500);
    }
}

async function getPendingWarning(req, res) {
    try {
        const warning = await UserWarning.findOne({
            where: { user_id: Number(req.user.id), status: 'pending' },
            include: [{ model: User, as: 'issuer', attributes: ['id', 'username', 'nickname'] }],
            order: [['created_at', 'ASC']]
        });
        return successResponse(res, warning);
    } catch (error) {
        console.error('获取待签署警告失败:', error);
        return errorResponse(res, '获取警告失败', 500);
    }
}

async function acknowledgeWarning(req, res) {
    try {
        const warningId = Number(req.params.warningId);
        const guarantee = String(req.body?.guarantee_text || '').trim();
        if (req.body?.accepted !== true) return errorResponse(res, '请先勾选遵守社区规范的承诺', 400);
        if (guarantee.length < 10 || guarantee.length > 1000) return errorResponse(res, '保证内容需为 10-1000 字', 400);
        const warning = await UserWarning.findOne({ where: { id: warningId, user_id: Number(req.user.id), status: 'pending' } });
        if (!warning) return errorResponse(res, '警告不存在或已经签署', 404);
        await warning.update({ status: 'acknowledged', guarantee_text: guarantee, acknowledged_at: new Date() });
        req.user = await User.findByPk(req.user.id);
        logOperation(req, 'acknowledge_user_warning', 'user_warning', warning.id, { guarantee_text: guarantee });
        return successResponse(res, null, '保证书已签署，请遵守社区规范');
    } catch (error) {
        console.error('签署保证书失败:', error);
        return errorResponse(res, '签署失败', 500);
    }
}

module.exports = { issueWarning, getPendingWarning, acknowledgeWarning };

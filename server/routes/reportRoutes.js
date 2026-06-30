const express = require('express');
const router = express.Router();
const { Report, User, Work, Comment, Post, Notification } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const { authMiddleware } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');
const DbAdapter = require('../utils/dbAdapter');
const { escapeHtml } = require('../utils/security');

const typeNames = {
    work: '作品',
    comment: '评论',
    post: '帖子',
    user: '用户'
};

/**
 * 创建举报（需要登录+验证码）
 */
router.post('/', authMiddleware, geetestVerify('report'), async (req, res) => {
    try {
        const { type, target_id, reason, description } = req.body;
        
        if (!type || !target_id || !reason) {
            return errorResponse(res, '请填写完整信息', 400);
        }

        if (!String(reason).trim() || String(reason).length > 200) {
            return errorResponse(res, '举报原因长度需在1~200字之间', 400);
        }

        if (description && String(description).length > 1000) {
            return errorResponse(res, '举报描述不能超过1000字', 400);
        }
        
        if (!['work', 'comment', 'post', 'user'].includes(type)) {
            return errorResponse(res, '无效的举报类型', 400);
        }
        
        let target;
        if (type === 'work') {
            target = await DbAdapter.findByPk(Work, target_id);
        } else if (type === 'comment') {
            target = await DbAdapter.findByPk(Comment, target_id);
        } else if (type === 'post') {
            target = await DbAdapter.findByPk(Post, target_id);
        } else {
            target = await DbAdapter.findByPk(User, target_id);
        }
        
        if (!target) {
            return errorResponse(res, '举报目标不存在', 404);
        }
        if ((type === 'work' || type === 'post') && target.status !== 'published') {
            return errorResponse(res, '举报目标不存在', 404);
        }
        if (type === 'comment' && target.status !== 'active') {
            return errorResponse(res, '举报目标不存在', 404);
        }
        if (type === 'comment' && target.work_id) {
            const work = await DbAdapter.findByPk(Work, target.work_id);
            if (!work || work.status !== 'published') {
                return errorResponse(res, '举报目标不存在', 404);
            }
        }
        if (type === 'comment' && target.post_id) {
            const post = await DbAdapter.findByPk(Post, target.post_id);
            if (!post || post.status !== 'published') {
                return errorResponse(res, '举报目标不存在', 404);
            }
        }
        
        const existing = await DbAdapter.findOne(Report, {
            where: {
                type,
                target_id,
                reporter_id: req.user.id,
                status: 'pending'
            }
        });
        
        if (existing) {
            return errorResponse(res, '您已举报过该内容，请等待处理', 400);
        }
        
        const report = await DbAdapter.create(Report, {
            type,
            target_id,
            reporter_id: req.user.id,
            reason,
            description,
            status: 'pending'
        });
        
        let targetName = '';
        let linkType = type;
        let linkId = target_id;

        if (type === 'work') {
            targetName = target.name;
            linkId = target.codemao_work_id || target.id;
        } else if (type === 'post') {
            targetName = target.title;
        } else if (type === 'comment') {
            targetName = target.content.substring(0, 20) + (target.content.length > 20 ? '...' : '');
            if (target.work_id) {
                linkType = 'work';
                const work = await DbAdapter.findByPk(Work, target.work_id);
                linkId = work ? (work.codemao_work_id || work.id) : target.work_id;
            } else if (target.post_id) {
                linkType = 'post';
                linkId = target.post_id;
            }
        } else if (type === 'user') {
            targetName = target.nickname || target.username;
        }

        const safeTargetName = escapeHtml(targetName);
        const safeReason = escapeHtml(reason);

        try {
            await DbAdapter.create(Notification, {
                user_id: req.user.id,
                type: 'system',
                title: '举报已提交',
                content: `您举报的${typeNames[type]}「${safeTargetName}」已提交成功，我们会尽快审核处理。举报原因：${safeReason}`,
                related_id: linkId,
                related_type: linkType
            });
        } catch (notifyErr) {
            console.error('Create report submitter notification error:', notifyErr);
        }

        // 通知审核员/管理员有新的举报待处理
        try {
            const { Op } = require('sequelize');
            const reviewers = await DbAdapter.findAll(User, {
                where: {
                    role: { [Op.in]: ['reviewer', 'moderator', 'admin', 'superadmin'] },
                    status: 'active'
                },
                attributes: ['id'],
                limit: 50
            });
            if (reviewers.length > 0) {
                await DbAdapter.bulkCreate(Notification, reviewers.map(r => ({
                    user_id: r.id,
                    type: 'report',
                    title: '收到新举报',
                    content: `有用户举报了${typeNames[type]}「${safeTargetName}」，原因：${safeReason}`,
                    related_id: linkId,
                    related_type: linkType
                })));
            }
        } catch (notifyErr) {
            // 通知失败不应回滚举报主流程
            console.error('Create report reviewer notification error:', notifyErr);
        }

        return successResponse(res, report, '举报成功，我们会尽快处理');
    } catch (error) {
        console.error('创建举报错误:', error);
        return errorResponse(res, '举报失败', 500);
    }
});

/**
 * 获取我的举报记录
 */
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        
        const { count, rows } = await DbAdapter.findAndCountAll(Report, {
            where: { reporter_id: req.user.id },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return successResponse(res, { list: rows, total: count });
    } catch (error) {
        console.error('获取举报记录错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
});

module.exports = router;

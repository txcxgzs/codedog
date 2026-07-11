const express = require('express');
const router = express.Router();
const { Report, User, Work, Comment, Post, Notification } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
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
            // 修复: type=user 时原代码按 User 主键(id)查找，但公开用户接口不返回本地主键，
            // 前端只能拿到 codemao_user_id，导致永远找不到目标用户。
            // 改为按 codemao_user_id 查找，前端传 target_id 时传 codemao_user_id。
            // 注意: codemao_user_id 字段类型为 STRING，统一转为字符串比较避免类型不匹配。
            target = await DbAdapter.findOne(User, { where: { codemao_user_id: String(target_id) } });
        }
        
        if (!target) {
            return errorResponse(res, '举报目标不存在', 404);
        }
        // 修复: hidden 作品仍允许被举报（用户可对已被管理员隐藏的内容追加证据）,
        // 只有 deleted 状态才视为不存在
        if ((type === 'work' || type === 'post') && target.status === 'deleted') {
            return errorResponse(res, '举报目标不存在', 404);
        }
        if (type === 'comment' && target.status === 'deleted') {
            return errorResponse(res, '举报目标不存在', 404);
        }
        if (type === 'comment' && target.work_id) {
            const work = await DbAdapter.findByPk(Work, target.work_id);
            if (!work || work.status === 'deleted') {
                return errorResponse(res, '举报目标不存在', 404);
            }
        }
        if (type === 'comment' && target.post_id) {
            const post = await DbAdapter.findByPk(Post, target.post_id);
            if (!post || post.status === 'deleted') {
                return errorResponse(res, '举报目标不存在', 404);
            }
        }

        // P0-3: Report.target_id 是 INTEGER，必须存本地主键。
        // type='user' 时前端传的 target_id 是 codemao_user_id(字符串)，
        // 不能直接落库，否则 adminController.findByPk(User, report.target_id) 永远查不到。
        // 统一用 DbAdapter.getId(target) 取本地整型主键：
        //   - work/comment/post: findByPk 入参即本地主键，getId(target) === target_id
        //   - user: getId(target) 返回 User.id(本地整型主键)
        const reportTargetId = DbAdapter.getId(target);

        const existing = await DbAdapter.findOne(Report, {
            where: {
                type,
                target_id: reportTargetId,
                reporter_id: req.user.id,
                status: 'pending'
            }
        });
        
        if (existing) {
            return errorResponse(res, '您已举报过该内容，请等待处理', 400);
        }
        
        const report = await DbAdapter.create(Report, {
            type,
            target_id: reportTargetId,
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

        // 修复 Bug-13: Notification.related_id 是 INTEGER 类型,linkId 可能是 codemao_work_id(字符串)。
        // SQLite 隐式转换但 MySQL strict mode 会报错。统一转为数字,无法转则用 null。
        const safeLinkId = (() => {
            const n = Number(linkId);
            return Number.isFinite(n) ? n : null;
        })();

        try {
            await DbAdapter.create(Notification, {
                user_id: req.user.id,
                type: 'system',
                title: '举报已提交',
                content: `您举报的${typeNames[type]}「${safeTargetName}」已提交成功，我们会尽快审核处理。举报原因：${safeReason}`,
                related_id: safeLinkId,
                related_type: linkType
            });
        } catch (notifyErr) {
            console.error('Create report submitter notification error:', notifyErr);
        }

        // 通知审核员/管理员有新的举报待处理
        try {
            const { Op } = require('sequelize');
            // Bug-18: 移除 limit:50 ——原实现若审核员/管理员超过 50 人，第 51+ 位永远收不到通知。
            // 改为拉取全部符合条件的审核员/管理员，并分批 bulkCreate（每批 100 条）避免单次
            // 写入过大导致内存压力，但保证所有合格审核员都被通知。
            const reviewers = await DbAdapter.findAll(User, {
                where: {
                    role: { [Op.in]: ['reviewer', 'moderator', 'admin', 'superadmin'] },
                    status: 'active'
                },
                attributes: ['id']
            });
            if (reviewers.length > 0) {
                const records = reviewers.map(r => ({
                    user_id: r.id,
                    type: 'report',
                    title: '收到新举报',
                    content: `有用户举报了${typeNames[type]}「${safeTargetName}」，原因：${safeReason}`,
                    related_id: safeLinkId,
                    related_type: linkType
                }));
                const BATCH_SIZE = 100;
                for (let i = 0; i < records.length; i += BATCH_SIZE) {
                    await DbAdapter.bulkCreate(Notification, records.slice(i, i + BATCH_SIZE));
                }
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
        // M3: 统一使用 DbAdapter.parsePagination 限制 pageSize 上限(<=100)
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);

        const { count, rows } = await DbAdapter.findAndCountAll(Report, {
            where: { reporter_id: req.user.id },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset
        });

        // L1: 统一使用 paginateResponse 返回，包含 pagination 字段
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取举报记录错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
});

module.exports = router;

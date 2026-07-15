const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Announcement, Banner, User, Statistics } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const DbAdapter = require('../utils/dbAdapter');
const { createRateLimiter } = require('../middleware/rateLimit');
const { JWT_SECRET } = require('../config/auth');

const visitRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 120,
    keyPrefix: 'site-visit'
});

function getChinaDateKey() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: process.env.STAT_TIMEZONE || 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

// 只保存每日轮换的 IP 哈希，不保存原始 IP；IP 必须来自 Express 的 trust proxy 解析结果。
function getDailyIpHash(req, dateKey) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const secret = process.env.VISIT_HASH_SECRET || JWT_SECRET;
    return crypto.createHmac('sha256', secret).update(`${dateKey}:${ip}`).digest('hex');
}

// 记录一次页面浏览。客户端不传 IP，避免伪造；同一 IP 当天仅生成一个 UV 键。
router.post('/visit', visitRateLimiter, async (req, res) => {
    try {
        const dateKey = getChinaDateKey();
        const statDate = new Date(`${dateKey}T00:00:00+08:00`);
        const pvKey = `site_pv:${dateKey}`;
        const uvKey = `site_uv:${dateKey}:${getDailyIpHash(req, dateKey)}`;

        const [pv] = await Statistics.findOrCreate({
            where: { stat_key: pvKey },
            defaults: { stat_value: 0, stat_date: statDate }
        });
        await pv.increment('stat_value', { by: 1 });
        await Statistics.findOrCreate({
            where: { stat_key: uvKey },
            defaults: { stat_value: 1, stat_date: statDate }
        });

        return successResponse(res, null);
    } catch (error) {
        console.error('记录网站访问统计失败:', error.message);
        return errorResponse(res, '记录访问统计失败', 500);
    }
});

// 获取活跃用户列表
router.get('/active-users', async (req, res) => {
    try {
        const users = await DbAdapter.findAll(User, {
            where: { 
                status: 'active',
                is_active_dalao: true 
            },
            order: [['experience', 'DESC'], ['work_count', 'DESC']],
            limit: 5,
            attributes: ['id', 'username', 'nickname', 'avatar', 'level', 'experience', 'codemao_user_id']
        });
        successResponse(res, users);
    } catch (error) {
        console.error('获取活跃用户错误:', error);
        errorResponse(res, '获取活跃用户失败', 500);
    }
});

// 获取公开公告列表
router.get('/announcements', async (req, res) => {
    try {
        const announcements = await DbAdapter.findAll(Announcement, {
            where: { is_active: true },
            order: [['created_at', 'DESC']],
            limit: 10
        });
        successResponse(res, announcements);
    } catch (error) {
        console.error('获取公告错误:', error);
        errorResponse(res, '获取公告失败', 500);
    }
});

// 获取轮播图列表
router.get('/banners', async (req, res) => {
    try {
        const banners = await DbAdapter.findAll(Banner, {
            where: { is_active: true },
            order: [['sort', 'ASC']]
        });
        successResponse(res, banners);
    } catch (error) {
        console.error('获取轮播图错误:', error);
        errorResponse(res, '获取轮播图失败', 500);
    }
});

module.exports = router;

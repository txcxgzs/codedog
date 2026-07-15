const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Announcement, Banner, User, sequelize } = require('../models');
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function withBusyRetry(operation, attempts = 6) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try { return await operation(); }
        catch (error) {
            const busy = /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(String(error?.message || ''));
            if (!busy || attempt === attempts - 1) throw error;
            // Small jitter prevents concurrent page views from retrying in lockstep.
            await sleep((25 * (2 ** attempt)) + Math.floor(Math.random() * 30));
        }
    }
}

// 记录一次页面浏览。客户端不传 IP，避免伪造；同一 IP 当天仅生成一个 UV 键。
router.post('/visit', visitRateLimiter, async (req, res) => {
    try {
        const dateKey = getChinaDateKey();
        const statDate = new Date(`${dateKey}T00:00:00+08:00`);
        const pvKey = `site_pv:${dateKey}`;
        const uvKey = `site_uv:${dateKey}:${getDailyIpHash(req, dateKey)}`;

        await withBusyRetry(async () => {
            if (sequelize.getDialect() === 'sqlite') {
                // Two atomic UPSERT statements replace findOrCreate + increment,
                // substantially shortening SQLite's write-lock duration.
                await sequelize.query(`
                    INSERT INTO statistics (stat_key, stat_value, stat_date, created_at, updated_at)
                    VALUES (:pvKey, 1, :statDate, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(stat_key) DO UPDATE SET
                      stat_value = statistics.stat_value + 1,
                      updated_at = CURRENT_TIMESTAMP
                `, { replacements: { pvKey, statDate } });
                await sequelize.query(`
                    INSERT INTO statistics (stat_key, stat_value, stat_date, created_at, updated_at)
                    VALUES (:uvKey, 1, :statDate, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(stat_key) DO NOTHING
                `, { replacements: { uvKey, statDate } });
            } else {
                await sequelize.query(`
                    INSERT INTO statistics (stat_key, stat_value, stat_date, created_at, updated_at)
                    VALUES (:pvKey, 1, :statDate, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON DUPLICATE KEY UPDATE stat_value = stat_value + 1, updated_at = CURRENT_TIMESTAMP
                `, { replacements: { pvKey, statDate } });
                await sequelize.query(`
                    INSERT IGNORE INTO statistics (stat_key, stat_value, stat_date, created_at, updated_at)
                    VALUES (:uvKey, 1, :statDate, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, { replacements: { uvKey, statDate } });
            }
        });

        return successResponse(res, null);
    } catch (error) {
        console.error('记录网站访问统计失败:', error.message);
        // Analytics must never break the page for a visitor. Keep the warning
        // in server logs and let the client continue normally.
        return successResponse(res, { recorded: false }, '访问成功，统计稍后补偿');
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

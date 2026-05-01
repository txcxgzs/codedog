const express = require('express');
const router = express.Router();
const { Announcement, Banner, User } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const DbAdapter = require('../utils/dbAdapter');

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

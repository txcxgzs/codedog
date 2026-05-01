/**
 * 作品路由
 */

const express = require('express');
const router = express.Router();
const workController = require('../controllers/workController');
const { authMiddleware } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');

// 发布作品（需要登录+验证码）
router.post('/publish', authMiddleware, geetestVerify('publish_work'), workController.publishWork);

// 获取作品列表
router.get('/', workController.getWorks);

// 获取推荐作品
router.get('/featured', workController.getFeaturedWorks);

// 获取我的作品（需要登录）
router.get('/my', authMiddleware, workController.getMyWorks);

// 获取用户作品
router.get('/user/:userId', workController.getUserWorks);

// 通过编程猫ID获取作品详情
router.get('/codemao/:codemaoId', workController.getWorkByCodemaoId);

// 点赞作品（需要登录+验证码）
router.post('/:codemaoId/like', authMiddleware, geetestVerify('like'), workController.likeWork);

// 更新作品（需要登录）
router.put('/:codemaoId', authMiddleware, workController.updateWork);

// 删除作品（需要登录）
router.delete('/:codemaoId', authMiddleware, workController.deleteWork);

// 获取作品详情（使用编程猫ID）
router.get('/:codemaoId', workController.getWorkDetail);

module.exports = router;

/**
 * 作品路由
 */

const express = require('express');
const router = express.Router();
const workController = require('../controllers/workController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');
const { createRateLimiter } = require('../middleware/rateLimit');

// 通用 API 限流，防止 GET /works/featured 等只读端点被滥用（参照 userRoutes.loginRateLimit 模式）
const apiRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: 'works-api'
});

// Report4 #21: 点赞端点专项限流，防止快速 toggle like/unlike 造成行锁竞争与
// SequelizeUniqueConstraintError 风暴（30 req/min/IP）
const likeRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: 'works-like'
});

// 发布作品（需要登录+验证码）
router.post('/publish', authMiddleware, geetestVerify('publish_work'), workController.publishWork);

// 导入编程猫作品（需要登录；用户导入自己的，管理员导入任意）
// 修复: 原 GET ?import=1 既有写副作用又同时要求 admin + 作者本人（矛盾），拆为独立 POST，按角色分支鉴权
router.post('/import/:codemaoId', authMiddleware, workController.importWork);

// 获取作品列表
router.get('/', workController.getWorks);

// 获取推荐作品（只读，加限流防滥用）
router.get('/featured', apiRateLimit, workController.getFeaturedWorks);
router.get('/sidebar-recommended', apiRateLimit, workController.getSidebarRecommendedWorks);

// 获取我的作品（需要登录）
router.get('/my', authMiddleware, workController.getMyWorks);

// 获取用户作品
router.get('/user/:userId', workController.getUserWorks);

// 通过编程猫ID获取作品详情（纯只读，命中返回，未命中 404，不再隐式导入）
router.get('/codemao/:codemaoId', optionalAuth, workController.getWorkByCodemaoId);

// 点赞作品（需要登录+验证码+点赞限流）
router.post('/:codemaoId/like', authMiddleware, likeRateLimit, geetestVerify('like'), workController.likeWork);

// 更新作品（需要登录）
router.put('/:codemaoId', authMiddleware, workController.updateWork);

// 删除作品（需要登录）
router.delete('/:codemaoId', authMiddleware, workController.deleteWork);

// 获取作品详情（使用编程猫ID）
router.get('/:codemaoId', optionalAuth, workController.getWorkDetail);

module.exports = router;

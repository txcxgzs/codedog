const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');
const { createRateLimiter } = require('../middleware/rateLimit');

// Report4 #21: 点赞/收藏类操作细粒度限流,30 次/分钟/IP,防止刷量
// 与 workController 使用同名 likeRateLimit 与 createRateLimiter 工厂保持一致
const likeRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: 'like-rate-limit'
});

// 公开路由
router.get('/', postController.getPosts);
router.get('/my/list', authMiddleware, postController.getMyPosts);
router.get('/:id', optionalAuth, postController.getPostDetail);

// 需要登录的路由
router.post('/', authMiddleware, geetestVerify('publish_post'), postController.createPost);
router.put('/:id', authMiddleware, postController.updatePost);
router.delete('/:id', authMiddleware, postController.deletePost);
router.post('/:id/like', authMiddleware, likeRateLimit, geetestVerify('like'), postController.likePost);
router.post('/:id/favorite', authMiddleware, likeRateLimit, geetestVerify('favorite'), postController.favoritePost);
router.delete('/:id/favorite', authMiddleware, likeRateLimit, geetestVerify('favorite'), postController.unfavoritePost);

module.exports = router;

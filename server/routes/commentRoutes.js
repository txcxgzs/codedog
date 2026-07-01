/**
 * 评论路由
 */

const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');
const { createRateLimiter } = require('../middleware/rateLimit');

// 报告4 #21(comment侧): 评论点赞/取消点赞细粒度限流,防止滥用刷点赞
// 与 work/post agents 侧 likeRateLimit 命名保持一致
const likeRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: 'comment-like'
});

// 公开路由
router.get('/work/:workId', optionalAuth, commentController.getWorkComments);

// 需要登录的路由
router.post('/', authMiddleware, geetestVerify('comment'), commentController.createComment);
router.delete('/:id', authMiddleware, commentController.deleteComment);
// likeComment 内部 toggle(点赞/取消点赞),故对 like 路由统一加 likeRateLimit(30 req/min/IP)
router.post('/:id/like', authMiddleware, likeRateLimit, geetestVerify('like'), commentController.likeComment);

module.exports = router;

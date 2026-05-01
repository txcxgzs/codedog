/**
 * 评论路由
 */

const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authMiddleware } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');

// 公开路由
router.get('/work/:workId', commentController.getWorkComments);

// 需要登录的路由
router.post('/', authMiddleware, geetestVerify('comment'), commentController.createComment);
router.delete('/:id', authMiddleware, commentController.deleteComment);
router.post('/:id/like', authMiddleware, geetestVerify('like'), commentController.likeComment);

module.exports = router;

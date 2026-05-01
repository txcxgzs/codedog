/**
 * 关注路由
 */

const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');
const { authMiddleware } = require('../middleware/auth');

// 关注用户（需要登录）
router.post('/', authMiddleware, followController.followUser);

// 取消关注（需要登录）
router.delete('/:codemaoUserId', authMiddleware, followController.unfollowUser);

// 检查是否已关注（需要登录）
router.get('/check/:codemaoUserId', authMiddleware, followController.checkFollow);

// 获取用户粉丝列表
router.get('/followers/:codemaoUserId', followController.getFollowers);

// 获取用户关注列表
router.get('/following/:codemaoUserId', followController.getFollowing);

module.exports = router;

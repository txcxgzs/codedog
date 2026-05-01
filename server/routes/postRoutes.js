const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authMiddleware } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');

// 公开路由
router.get('/', postController.getPosts);
router.get('/my/list', authMiddleware, postController.getMyPosts);
router.get('/:id', postController.getPostDetail);

// 需要登录的路由
router.post('/', authMiddleware, geetestVerify('publish_post'), postController.createPost);
router.put('/:id', authMiddleware, postController.updatePost);
router.delete('/:id', authMiddleware, postController.deletePost);
router.post('/:id/like', authMiddleware, geetestVerify('like'), postController.likePost);
router.post('/:id/favorite', authMiddleware, geetestVerify('favorite'), postController.favoritePost);
router.delete('/:id/favorite', authMiddleware, geetestVerify('favorite'), postController.unfavoritePost);

module.exports = router;

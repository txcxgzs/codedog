/**
 * 收藏路由
 */

const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');

// 需要登录的路由
router.post('/', authMiddleware, geetestVerify('favorite'), favoriteController.addFavorite);
router.delete('/:workId', authMiddleware, geetestVerify('favorite'), favoriteController.removeFavorite);
router.get('/my', authMiddleware, favoriteController.getMyFavorites);
router.get('/user/:codemaoUserId', optionalAuth, favoriteController.getUserFavorites);
router.get('/check/:workId', authMiddleware, favoriteController.checkFavorite);

module.exports = router;

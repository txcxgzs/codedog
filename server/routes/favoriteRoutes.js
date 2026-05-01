/**
 * 收藏路由
 */

const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authMiddleware } = require('../middleware/auth');

// 需要登录的路由
router.post('/', authMiddleware, favoriteController.addFavorite);
router.delete('/:workId', authMiddleware, favoriteController.removeFavorite);
router.get('/my', authMiddleware, favoriteController.getMyFavorites);
router.get('/check/:workId', authMiddleware, favoriteController.checkFavorite);

module.exports = router;

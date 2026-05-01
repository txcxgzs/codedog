/**
 * 消息通知路由
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/auth');

// 所有通知路由都需要登录
router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/clear/all', notificationController.clearAll);

module.exports = router;

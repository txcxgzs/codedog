/**
 * 后台管理路由
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/permission');

/**
 * 以下路由需要管理员权限
 * 注意：第一个使用编程猫登录的用户将自动成为超级管理员
 */
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * 统计数据
 */
router.get('/stats', adminController.getStats);
router.get('/trends', adminController.getTrends);
router.get('/captcha-stats', requireRole('admin'), adminController.getCaptchaStats);

/**
 * 角色管理（仅超级管理员）
 */
router.get('/roles', requireRole('superadmin'), adminController.getRoles);
router.get('/admin-users', requireRole('admin'), adminController.getAdminUsers);

/**
 * 用户管理
 */
router.get('/users', requirePermission('user:view'), adminController.getUsers);
router.get('/users/:userId', requirePermission('user:view'), adminController.getUserDetail);
router.put('/users/:userId', requireRole('admin'), adminController.updateUser);
router.post('/users/:userId/impersonate', requireRole('admin'), adminController.impersonateUser);
router.put('/users/:userId/password', requireRole('admin'), adminController.updateUserPassword);
router.put('/users/:userId/status', requirePermission('user:disable'), adminController.updateUserStatus);
router.put('/users/:userId/role', requireRole('admin'), adminController.updateUserRole);
router.delete('/users/:userId', requireRole('superadmin'), adminController.deleteUser);
router.post('/users/:userId/notification', requireRole('admin'), adminController.sendUserNotification);
router.post('/users/batch-notification', requireRole('admin'), adminController.sendBatchNotifications);
router.post('/users/all-notification', requireRole('admin'), adminController.sendAllUsersNotification);
router.put('/users/:userId/level', requireRole('admin'), adminController.updateUserLevel);

/**
 * 作品管理
 */
router.get('/works', requirePermission('work:review'), adminController.getWorks);
router.put('/works/:workId', requirePermission('work:edit'), adminController.updateWork);
router.put('/works/:workId/featured', requirePermission('work:feature'), adminController.setWorkFeatured);
router.delete('/works/:workId', requirePermission('work:delete'), adminController.deleteWork);
router.post('/works/recalibrate', requireRole('admin'), adminController.recalibrateAllWorks);

/**
 * 评论管理
 */
router.get('/comments', requirePermission('comment:review'), adminController.getComments);
router.put('/comments/:commentId/status', requirePermission('comment:review'), adminController.updateCommentStatus);
router.delete('/comments/:commentId', requirePermission('comment:delete'), adminController.deleteComment);

/**
 * 帖子管理
 */
router.get('/posts', requirePermission('post:review'), adminController.getPosts);
router.put('/posts/:postId/essence', requirePermission('post:edit'), adminController.setPostEssence);
router.put('/posts/:postId/top', requirePermission('post:sticky'), adminController.setPostTop);
router.put('/posts/:postId', requirePermission('post:edit'), adminController.updatePost);
router.delete('/posts/:postId', requirePermission('post:delete'), adminController.deletePost);

/**
 * 轮播图管理
 */
router.get('/banners', requirePermission('banner:view'), adminController.getBanners);
router.post('/banners', requirePermission('banner:create'), adminController.createBanner);
router.put('/banners/:bannerId', requirePermission('banner:edit'), adminController.updateBanner);
router.delete('/banners/:bannerId', requirePermission('banner:delete'), adminController.deleteBanner);

/**
 * 举报管理
 */
router.get('/reports', requirePermission('report:view'), adminController.getReports);
router.put('/reports/:reportId', requirePermission('report:handle'), adminController.handleReport);

/**
 * IP封禁管理
 */
router.get('/ip-bans', requireRole('admin'), adminController.getIpBans);
router.post('/ip-bans', requireRole('admin'), adminController.addIpBan);
router.delete('/ip-bans/:ipBanId', requireRole('admin'), adminController.removeIpBan);

/**
 * 爬取功能
 */
router.post('/crawl/work', requirePermission('crawl:works'), adminController.crawlWork);
router.post('/crawl/hot', requirePermission('crawl:works'), adminController.crawlHotWorks);
router.post('/crawl/user', requirePermission('crawl:works'), adminController.crawlUserWorks);
router.post('/crawl/posts', requirePermission('crawl:works'), adminController.crawlPostWorks);
router.post('/crawl/banners', requireRole('admin'), adminController.crawlBanners);
router.get('/crawl/logs', requirePermission('crawl:works'), adminController.getCrawlLogs);

/**
 * 实时日志
 */
router.get('/logs/realtime', requireRole('admin'), adminController.getRealtimeLogs);
router.delete('/logs/realtime', requireRole('admin'), adminController.clearRealtimeLogs);

/**
 * 公告管理
 */
router.get('/announcements', requirePermission('announcement:view'), adminController.getAnnouncements);
router.post('/announcements', requirePermission('announcement:create'), adminController.createAnnouncement);
router.put('/announcements/:announcementId', requirePermission('announcement:edit'), adminController.updateAnnouncement);
router.delete('/announcements/:announcementId', requirePermission('announcement:delete'), adminController.deleteAnnouncement);

/**
 * 系统设置
 */
router.get('/configs', requireRole('admin'), adminController.getSystemConfigs);
router.put('/configs/:key', requireRole('admin'), adminController.updateSystemConfig);
router.post('/configs/batch', requireRole('admin'), adminController.batchUpdateConfigs);

/**
 * 操作日志
 */
router.get('/operation-logs', requireRole('admin'), adminController.getOperationLogs);

/**
 * 敏感词管理
 */
router.get('/sensitive-words', requireRole('admin'), adminController.getSensitiveWords);
router.post('/sensitive-words', requireRole('admin'), adminController.addSensitiveWord);
router.put('/sensitive-words/:wordId', requireRole('admin'), adminController.updateSensitiveWord);
router.delete('/sensitive-words/:wordId', requireRole('admin'), adminController.deleteSensitiveWord);
router.post('/sensitive-words/batch-import', requireRole('admin'), adminController.batchImportSensitiveWords);

/**
 * AI审核
 */
router.post('/ai/review/:reportId', requirePermission('report:handle'), adminController.aiReviewReport);
router.post('/ai/batch-review', requirePermission('report:handle'), adminController.aiBatchReviewReports);
router.post('/ai/auto-handle', requirePermission('report:handle'), adminController.aiAutoHandleReports);

/**
 * 权限管理（仅超级管理员）
 */
router.get('/permissions', requireRole('superadmin'), adminController.getPermissions);
router.get('/role-permissions', requireRole('superadmin'), adminController.getRolePermissionsList);
router.put('/role-permissions/:role', requireRole('superadmin'), adminController.updateRolePermissions);
router.post('/role-permissions/:role/reset', requireRole('superadmin'), adminController.resetRolePermissions);

/**
 * 工作室管理
 */
router.get('/studios', requireRole('admin'), adminController.getStudios);
router.get('/studios/:id', requireRole('admin'), adminController.getStudioDetail);
router.put('/studios/:id', requireRole('admin'), adminController.updateStudio);
router.put('/studios/:id/status', requireRole('admin'), adminController.updateStudioStatus);
router.put('/studios/:id/points', requireRole('admin'), adminController.updateStudioPoints);
router.put('/studios/:studioId/members/:userId', requireRole('admin'), adminController.updateStudioMember);
router.delete('/studios/:studioId/members/:userId', requireRole('admin'), adminController.removeStudioMember);
router.delete('/studios/:studioId/works/:workId', requireRole('admin'), adminController.removeStudioWork);
router.delete('/studios/:id', requireRole('admin'), adminController.deleteStudio);

/**
 * 工作室作品管理
 */
router.put('/studio-works/:id/score', requireRole('admin'), adminController.setWorkScore);

module.exports = router;

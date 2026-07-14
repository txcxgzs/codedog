const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const { StudioMember, Studio, Follow, Favorite, Like, Work, Post, User, DeveloperApp } = require('../models');
const { oauthAuth, requireScopes } = require('../middleware/oauthAuth');
const { perAppRateLimiter, failLogMiddleware, captureRequest, installResponseCapture, redact } = require('../middleware/developerOpenApi');

const models = { DeveloperApp };

router.use(failLogMiddleware(models));
router.use(oauthAuth);
router.use(function (req, res, next) {
    installResponseCapture(res);
    res.on('finish', function () {
        // Skip failed-auth responses (401/403); those are logged separately as developer_api_fail by failLogMiddleware
        if (res.statusCode === 401 || res.statusCode === 403) return;
        const logger = require('../services/developerApiLogger').getDeveloperApiLogger(require('../models'));
        logger.log({
            user_id: req.oauth && req.oauth.userId || null,
            action: 'developer_api_call',
            target_type: 'developer_app',
            target_id: req.oauth && req.oauth.appId || null,
            details: JSON.stringify({
                method: req.method,
                path: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
                status: res.statusCode,
                oauth_user_id: req.oauth && req.oauth.userId || null,
                request: captureRequest(req),
                response: (() => { try { return redact(JSON.parse(res.__developerResponseBody || 'null')); } catch (_) { return (res.__developerResponseBody || '').slice(0, 16384); } })()
            }),
            ip_address: req.ip || req.socket && req.socket.remoteAddress || 'unknown',
            user_agent: req.headers['user-agent'] || null
        });
    });
    next();
});
router.use(perAppRateLimiter(models));

router.get('/me', requireScopes('profile:read'), developerController.openMe);
router.get('/me/works', requireScopes('works:read'), developerController.openMyWorks);
router.get('/me/works/stats', requireScopes('works:stats:read'), developerController.openMyWorkStats);
router.get('/me/works/:id/stats', requireScopes('works:stats:read'), developerController.openMyWorkStats);
router.get('/me/works/:id', requireScopes('works:read'), developerController.openMyWorkDetail);
router.get('/me/comments', requireScopes('comments:read'), developerController.openMyComments);
router.get('/me/posts', requireScopes('posts:read'), developerController.openMyPosts);
router.get('/me/posts/:id', requireScopes('posts:read'), developerController.openMyPostDetail);

router.get('/me/studios', requireScopes('studios:read'), developerController.openMyStudios);
router.get('/me/studios/:id', requireScopes('studios:read'), developerController.openMyStudioDetail);
router.get('/me/followers', requireScopes('follows:read'), developerController.openMyFollowers);
router.get('/me/following', requireScopes('follows:read'), developerController.openMyFollowing);
router.get('/me/favorites', requireScopes('favorites:read'), developerController.openMyFavorites);
router.get('/me/likes', requireScopes('favorites:read'), developerController.openMyLikes);
router.get('/me/notifications', requireScopes('notifications:read'), developerController.openMyNotifications);
router.post('/me/notifications', requireScopes('notifications:write'), developerController.openSendNotification);
router.get('/me/activity', requireScopes('community:activity:read'), developerController.openMyActivity);
router.get('/me/studios/:id/members', requireScopes('studios:members:read'), developerController.openMyStudioMembers);

router.post('/comments', requireScopes('comments:write'), developerController.openCreateComment);
router.delete('/comments/:id', requireScopes('comments:write'), developerController.openDeleteComment);
router.post('/posts', requireScopes('posts:write'), developerController.openCreatePost);
router.patch('/posts/:id', requireScopes('posts:write'), developerController.openUpdatePost);
router.delete('/posts/:id', requireScopes('posts:write'), developerController.openDeletePost);
router.post('/works', requireScopes('works:write'), developerController.openPublishWork);
router.patch('/works/:id', requireScopes('works:write'), developerController.openUpdateWork);
router.delete('/works/:id', requireScopes('works:write'), developerController.openDeleteWork);

router.get('/reports', requireScopes('reports:read'), developerController.openReports);
router.patch('/reports/:id', requireScopes('reports:write'), developerController.openHandleReport);

router.get('/studios/pending-review', requireScopes('studios:review'), developerController.openStudiosPendingReview);
router.post('/studios/:id/review', requireScopes('studios:review'), developerController.openReviewStudio);


module.exports = router;

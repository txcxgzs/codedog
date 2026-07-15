const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const { StudioMember, Studio, Follow, Favorite, Like, Work, Post, User, DeveloperApp } = require('../models');
const { oauthAuth, requireScopes, requireAnyScopes } = require('../middleware/oauthAuth');
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
router.get('/me/openid', requireScopes('openid'), developerController.openAppOpenId);
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
router.get('/me/likes', requireAnyScopes('likes:read', 'favorites:read'), developerController.openMyLikes);
router.get('/me/notifications', requireScopes('notifications:read'), developerController.openMyNotifications);
router.post('/me/notifications', requireScopes('notifications:write'), developerController.openSendNotification);
router.get('/me/activity', requireScopes('community:activity:read'), developerController.openMyActivity);
router.get('/me/studios/:id/members', requireScopes('studios:members:read'), developerController.openMyStudioMembers);
router.get('/me/analytics/works', requireScopes('works:analytics:read'), developerController.openMyWorksAnalytics);
router.get('/me/analytics/posts', requireScopes('posts:analytics:read'), developerController.openMyPostsAnalytics);
router.get('/me/analytics/account', requireScopes('account:analytics:read'), developerController.openMyAccountAnalytics);
router.get('/me/comments/received', requireScopes('comments:received:read'), developerController.openCommentsReceived);

router.get('/users/:id', requireScopes('users:public:read'), developerController.openPublicUser);
router.get('/works', requireScopes('works:public:read'), developerController.openPublicWorks);
router.get('/works/:id', requireScopes('works:public:read'), developerController.openPublicWorkDetail);
router.get('/posts', requireScopes('posts:public:read'), developerController.openPublicPosts);
router.get('/posts/:id', requireScopes('posts:public:read'), developerController.openPublicPostDetail);
router.get('/studios/pending-review', requireScopes('studios:review'), developerController.openStudiosPendingReview);
router.post('/studios/:id/review', requireScopes('studios:review'), developerController.openReviewStudio);
router.get('/studios', requireScopes('studios:public:read'), developerController.openPublicStudios);
router.get('/studios/:id', requireScopes('studios:public:read'), developerController.openPublicStudioDetail);
router.get('/search', requireScopes('search:read'), developerController.openSearch);
router.get('/community/feed', requireScopes('community:feed:read'), developerController.openCommunityFeed);
router.get('/community/stats', requireScopes('community:stats:read'), developerController.openCommunityStats);

router.get('/me/studios/:id/applications', requireScopes('studios:applications:read'), developerController.openStudioApplications);
router.get('/me/studios/:id/submissions', requireScopes('studios:submissions:read'), developerController.openStudioSubmissions);
router.get('/me/studios/:id/analytics', requireScopes('studios:analytics:read'), developerController.openStudioAnalytics);
router.get('/me/studios/:id/logs', requireScopes('studios:logs:read'), developerController.openStudioLogs);
router.get('/developer/usage', requireScopes('developer:usage:read'), developerController.openDeveloperUsage);

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

module.exports = router;

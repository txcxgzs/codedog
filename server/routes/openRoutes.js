/**
 * Open API v1 (OAuth2 access_token)
 */
const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const { oauthAuth, requireScopes } = require('../middleware/oauthAuth');
const { createRateLimiter } = require('../middleware/rateLimit');

const openApiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: 'open-api',
    keyGenerator: (req) => {
        const appId = req.oauth?.appId || 'unknown';
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        return `${appId}:${ip}`;
    }
});

router.use(oauthAuth);
router.use(openApiRateLimiter);

router.get('/me', requireScopes('profile:read'), developerController.openMe);
router.get('/me/works', requireScopes('works:read'), developerController.openMyWorks);
router.get('/me/works/:id', requireScopes('works:read'), developerController.openMyWorkDetail);
router.get('/me/comments', requireScopes('comments:read'), developerController.openMyComments);
router.get('/me/posts', requireScopes('posts:read'), developerController.openMyPosts);
router.get('/me/posts/:id', requireScopes('posts:read'), developerController.openMyPostDetail);

module.exports = router;

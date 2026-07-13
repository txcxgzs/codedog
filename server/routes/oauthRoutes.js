/**
 * OAuth2 token / authorize API routes
 */
const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { oauthAuth, requireScopes } = require('../middleware/oauthAuth');
const { authFailLimiter } = require('../middleware/developerOpenApi');

// Public: authorize info (login optional for preview; approve needs auth)
router.get('/authorize-info', optionalAuth, developerController.getAuthorizeInfo);

// User must be logged in to approve/deny
router.post('/authorize', authMiddleware, developerController.approveAuthorize);

// Token endpoints (client credentials)
router.post('/token', authFailLimiter, developerController.tokenEndpoint);
router.post('/revoke', developerController.revokeToken);

// Optional OIDC-style userinfo using access_token
router.get('/userinfo', oauthAuth, requireScopes('profile:read'), developerController.userinfo);

module.exports = router;

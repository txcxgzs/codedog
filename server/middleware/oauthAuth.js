/**
 * OAuth2 open API authentication middleware
 */
const { DeveloperApp, OAuthAccessToken, User } = require('../models');
const DbAdapter = require('../utils/dbAdapter');
const { errorResponse } = require('./response');
const { hashToken, parseJsonField, hasScope, normalizeScopes } = require('../utils/oauth');
const { Op } = require('sequelize');

function getBearerToken(req) {
    const header = req.headers.authorization || req.headers.Authorization || '';
    const m = String(header).match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : null;
}

async function oauthAuth(req, res, next) {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return errorResponse(res, '缺少 access_token', 401, 'oauth_missing_token');
        }

        const tokenHash = hashToken(token);
        const record = await DbAdapter.findOne(OAuthAccessToken, {
            where: {
                token_hash: tokenHash,
                revoked_at: null,
                expires_at: { [Op.gt]: new Date() }
            },
            include: [
                { model: DeveloperApp, as: 'app' },
                { model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar', 'bio', 'level', 'follower_count', 'following_count', 'work_count', 'status', 'role'] }
            ]
        });

        if (!record) {
            return errorResponse(res, 'access_token 无效或已过期', 401, 'oauth_invalid_token');
        }

        const app = record.app;
        const user = record.user;
        if (!app || app.status !== 'active') {
            return errorResponse(res, '应用不可用或未审核通过', 403, 'oauth_app_inactive');
        }
        if (!user || user.status !== 'active') {
            return errorResponse(res, '授权用户不可用', 403, 'oauth_user_inactive');
        }

        req.oauth = {
            token: record,
            app,
            user,
            scopes: parseJsonField(record.scopes, []),
            appId: DbAdapter.getId(app),
            userId: DbAdapter.getId(user)
        };
        next();
    } catch (error) {
        console.error('oauthAuth error:', error);
        return errorResponse(res, '鉴权失败', 500);
    }
}

function requireScopes(...needed) {
    return (req, res, next) => {
        const granted = req.oauth?.scopes || [];
        for (const scope of needed) {
            if (!hasScope(granted, scope)) {
                return errorResponse(res, `缺少权限 scope: ${scope}`, 403, 'oauth_insufficient_scope');
            }
        }
        next();
    };
}

module.exports = { oauthAuth, requireScopes, getBearerToken };

/**
 * Developer platform + OAuth2 controller
 */
const { Op } = require('sequelize');
const {
    User, Work, Comment, Post, DeveloperApp, DeveloperAppAuditLog, OAuthAuthCode, OAuthAccessToken,
    OAuthRefreshToken, UserAppAuthorization, sequelize,
    StudioMember, Studio, StudioWork, Follow, Favorite, Like, Notification, OperationLog
} = require('../models');
const DbAdapter = require('../utils/dbAdapter');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { logOperation } = require('../middleware/operationLog');
const oauth = require('../utils/oauth');
const { getDeveloperApiLogger } = require('../services/developerApiLogger');
const { DEFAULT_RATE_LIMIT_PER_MIN } = require('../middleware/developerOpenApi');
const { hasPermission } = require('../config/permissions');
const commentController = require('./commentController');
const postController = require('./postController');
const workController = require('./workController');
const adminController = require('./adminController');
const { createNotification } = require('./notificationController');
const fs = require('fs');
const { uploadToImageHost } = require('../services/imageHost');

function getOwnerId(req) {
    return DbAdapter.getId(req.user);
}

function serializeApp(app, extra = {}) {
    return Object.assign(oauth.publicAppView(app), extra);
}

async function listMyApps(req, res) {
    try {
        const apps = await DbAdapter.findAll(DeveloperApp, {
            where: { owner_user_id: getOwnerId(req) },
            order: [['created_at', 'DESC']]
        });
        return successResponse(res, apps.map(a => serializeApp(a)));
    } catch (e) {
        console.error('listMyApps', e);
        return errorResponse(res, '获取应用列表失败', 500);
    }
}

async function getMyApp(req, res) {
    try {
        const app = await DbAdapter.findOne(DeveloperApp, {
            where: { id: req.params.id, owner_user_id: getOwnerId(req) }
        });
        if (!app) return errorResponse(res, '应用不存在', 404);
        return successResponse(res, serializeApp(app));
    } catch (e) {
        console.error('getMyApp', e);
        return errorResponse(res, '获取应用失败', 500);
    }
}

async function createApp(req, res) {
    try {
        const { name, description, homepage_url, logo_url, redirect_uris, scopes } = req.body || {};
        const trimmedName = name != null ? String(name).trim() : '';
        if (!trimmedName) return errorResponse(res, '应用名称不能为空', 400);
        if (trimmedName.length > 100) return errorResponse(res, '应用名称不能超过100字', 400);

        const uris = oauth.normalizeRedirectUris(redirect_uris);
        if (!uris.ok) return errorResponse(res, uris.msg, 400);

        let scopeList = oauth.normalizeScopes(scopes);
        if (scopeList.length === 0) scopeList = [...oauth.DEFAULT_SCOPES];

        const clientId = oauth.randomToken('app_', 16);
        const clientSecret = oauth.randomToken('sk_', 24);
        const clientSecretHash = await oauth.hashSecret(clientSecret);

        const app = await DbAdapter.create(DeveloperApp, {
            owner_user_id: getOwnerId(req),
            name: trimmedName,
            description: description != null ? String(description).trim() : null,
            homepage_url: homepage_url != null ? String(homepage_url).trim() : null,
            logo_url: logo_url != null ? String(logo_url).trim() : null,
            client_id: clientId,
            client_secret_hash: clientSecretHash,
            redirect_uris: oauth.stringifyJsonField(uris.list),
            scopes_requested: oauth.stringifyJsonField(scopeList),
            status: 'pending',
            rate_limit_per_min: 60
        });

        logOperation(req, 'create_developer_app', 'developer_app', DbAdapter.getId(app), { name: trimmedName });
        return successResponse(res, serializeApp(app, {
            client_secret: clientSecret,
            client_secret_notice: '请立即保存 client_secret，关闭后无法再次查看明文'
        }), '创建成功，等待审核');
    } catch (e) {
        console.error('createApp', e);
        return errorResponse(res, '创建应用失败', 500);
    }
}

async function updateApp(req, res) {
    try {
        const app = await DbAdapter.findOne(DeveloperApp, {
            where: { id: req.params.id, owner_user_id: getOwnerId(req) }
        });
        if (!app) return errorResponse(res, '应用不存在', 404);
        if (app.status === 'suspended') return errorResponse(res, '应用已被停用，无法修改', 400);

        const { name, description, homepage_url, logo_url, redirect_uris, scopes } = req.body || {};
        const updateData = {};
        let sensitiveChanged = false;
        let nextScopeList = null;

        if (name !== undefined) {
            const n = String(name).trim();
            if (!n) return errorResponse(res, '应用名称不能为空', 400);
            if (n.length > 100) return errorResponse(res, '应用名称不能超过100字', 400);
            updateData.name = n;
        }
        if (description !== undefined) updateData.description = description == null ? null : String(description).trim();
        if (homepage_url !== undefined) updateData.homepage_url = homepage_url == null ? null : String(homepage_url).trim();
        if (logo_url !== undefined) updateData.logo_url = logo_url == null ? null : String(logo_url).trim();

        if (redirect_uris !== undefined) {
            const uris = oauth.normalizeRedirectUris(redirect_uris);
            if (!uris.ok) return errorResponse(res, uris.msg, 400);
            updateData.redirect_uris = oauth.stringifyJsonField(uris.list);
            sensitiveChanged = true;
        }
        if (scopes !== undefined) {
            let scopeList = oauth.normalizeScopes(scopes);
            if (scopeList.length === 0) return errorResponse(res, '至少选择一个权限范围', 400);
            nextScopeList = scopeList;
            updateData.scopes_requested = oauth.stringifyJsonField(scopeList);
            sensitiveChanged = true;
        }

        if (sensitiveChanged && (app.status === 'active' || app.status === 'rejected')) {
            updateData.status = 'pending';
            updateData.review_note = null;
            updateData.reviewed_by = null;
            updateData.reviewed_at = null;
        }

        await sequelize.transaction(async (t) => {
            await DbAdapter.update(DeveloperApp, updateData, { where: { id: app.id }, transaction: t });

            if (sensitiveChanged) {
                const now = new Date();
                // 回调地址或权限发生变化后，旧授权码/令牌不能在重新审核通过后恢复使用。
                await DbAdapter.destroy(OAuthAuthCode, { where: { app_id: app.id }, transaction: t });
                await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, {
                    where: { app_id: app.id, revoked_at: null }, transaction: t
                });
                await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, {
                    where: { app_id: app.id, revoked_at: null }, transaction: t
                });

                // 应用缩减权限时，同步收缩用户历史授权，避免后续授权合并时恢复已删除 scope。
                if (nextScopeList) {
                    const authorizations = await DbAdapter.findAll(UserAppAuthorization, {
                        where: { app_id: app.id, revoked_at: null }, transaction: t
                    });
                    for (const authorization of authorizations) {
                        const narrowed = oauth.intersectScopes(
                            oauth.parseJsonField(authorization.scopes, []),
                            nextScopeList
                        );
                        const authorizationId = DbAdapter.getId(authorization);
                        if (narrowed.length === 0) {
                            await DbAdapter.update(UserAppAuthorization, { revoked_at: now }, {
                                where: { id: authorizationId }, transaction: t
                            });
                        } else {
                            await DbAdapter.update(UserAppAuthorization, {
                                scopes: oauth.stringifyJsonField(narrowed)
                            }, { where: { id: authorizationId }, transaction: t });
                        }
                    }
                }
            }
        });
        const updated = await DbAdapter.findByPk(DeveloperApp, app.id);
        logOperation(req, 'update_developer_app', 'developer_app', app.id, updateData);
        return successResponse(res, serializeApp(updated), sensitiveChanged ? '已保存，敏感变更需重新审核' : '保存成功');
    } catch (e) {
        console.error('updateApp', e);
        return errorResponse(res, '更新应用失败', 500);
    }
}

async function rotateSecret(req, res) {
    try {
        const app = await DbAdapter.findOne(DeveloperApp, {
            where: { id: req.params.id, owner_user_id: getOwnerId(req) }
        });
        if (!app) return errorResponse(res, '应用不存在', 404);
        if (app.status !== 'active') return errorResponse(res, '仅已通过审核的应用可重置密钥', 400);

        const clientSecret = oauth.randomToken('sk_', 24);
        const clientSecretHash = await oauth.hashSecret(clientSecret);
        await DbAdapter.update(DeveloperApp, { client_secret_hash: clientSecretHash }, { where: { id: app.id } });

        // revoke existing tokens for safety
        const now = new Date();
        await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
        await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });

        logOperation(req, 'rotate_developer_app_secret', 'developer_app', app.id, {});
        return successResponse(res, {
            client_id: app.client_id,
            client_secret: clientSecret,
            client_secret_notice: '请立即保存 client_secret，关闭后无法再次查看明文'
        }, '密钥已重置，旧 token 已失效');
    } catch (e) {
        console.error('rotateSecret', e);
        return errorResponse(res, '重置密钥失败', 500);
    }
}

async function getScopeDocs(req, res) {
    return successResponse(res, {
        scopes: oauth.scopeCatalog(),
        token: {
            access_token_ttl: '2h',
            refresh_token_ttl: '30d',
            auth_code_ttl: '10m'
        },
        endpoints: {
            authorize: '/oauth/authorize',
            token: '/api/oauth/token',
            revoke: '/api/oauth/revoke',
            userinfo: '/api/oauth/userinfo',
            open_api_base: '/api/open/v1'
        }
    });
}

// -------- Admin --------
async function adminListApps(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const where = {};
        if (req.query.status) where.status = req.query.status;
        if (req.query.keyword) {
            where.name = { [Op.like]: `%${String(req.query.keyword).trim()}%` };
        }
        const { count, rows } = await DbAdapter.findAndCountAll(DeveloperApp, {
            where,
            include: [
                { model: User, as: 'owner', attributes: ['id', 'username', 'nickname', 'avatar'] },
                { model: User, as: 'reviewer', attributes: ['id', 'username', 'nickname'], required: false }
            ],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset
        });
        const list = rows.map(r => {
            const json = r.toJSON ? r.toJSON() : r;
            return {
                ...serializeApp(json),
                owner: json.owner || null,
                reviewer: json.reviewer || null,
                reviewed_by: json.reviewed_by,
                owner_user_id: json.owner_user_id
            };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error('adminListApps', e);
        return errorResponse(res, '获取开发者应用失败', 500);
    }
}

async function adminGetApp(req, res) {
    try {
        const app = await DeveloperApp.findByPk(req.params.id, {
            include: [
                { model: User, as: 'owner', attributes: ['id', 'username', 'nickname', 'avatar'] },
                { model: User, as: 'reviewer', attributes: ['id', 'username', 'nickname'], required: false }
            ]
        });
        if (!app) return errorResponse(res, '应用不存在', 404);
        const appId = DbAdapter.getId(app);
        const now = new Date();
        const [authorizationCount, activeAuthorizationCount, accessTokenCount, activeAccessTokenCount, callCount, auditCount] = await Promise.all([
            DbAdapter.count(UserAppAuthorization, { where: { app_id: appId } }),
            DbAdapter.count(UserAppAuthorization, { where: { app_id: appId, revoked_at: null } }),
            DbAdapter.count(OAuthAccessToken, { where: { app_id: appId } }),
            DbAdapter.count(OAuthAccessToken, { where: { app_id: appId, revoked_at: null, expires_at: { [Op.gt]: now } } }),
            DbAdapter.count(OperationLog, { where: { action: 'developer_api_call', target_type: 'developer_app', target_id: appId } }),
            DbAdapter.count(DeveloperAppAuditLog, { where: { app_id: appId } })
        ]);
        const json = app.toJSON();
        return successResponse(res, {
            ...serializeApp(json),
            owner: json.owner || null,
            reviewer: json.reviewer || null,
            reviewed_by: json.reviewed_by,
            owner_user_id: json.owner_user_id,
            stats: { authorizationCount, activeAuthorizationCount, accessTokenCount, activeAccessTokenCount, callCount, auditCount }
        });
    } catch (e) {
        console.error('adminGetApp', e);
        return errorResponse(res, '获取开发者应用详情失败', 500);
    }
}

async function uploadAppLogo(req, res) {
    try {
        const app = await DbAdapter.findOne(DeveloperApp, { where: { id: req.params.id, owner_user_id: getOwnerId(req) } });
        if (!app || !req.file) return errorResponse(res, '应用或图标不存在', 404);
        const logoUrl = await uploadToImageHost(req.file);
        await DbAdapter.update(DeveloperApp, { logo_url: logoUrl }, { where: { id: app.id } });
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return successResponse(res, { logo_url: logoUrl }, '图标上传成功');
    } catch (e) { console.error('uploadAppLogo', e); return errorResponse(res, '上传应用图标失败', 500); }
}

async function listMyAppCalls(req, res) {
    try {
        const app = await DbAdapter.findOne(DeveloperApp, { where: { id: req.params.id, owner_user_id: getOwnerId(req) } });
        if (!app) return errorResponse(res, '应用不存在', 404);
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(OperationLog, {
            where: { action: { [Op.in]: ['developer_api_call', 'developer_api_fail'] }, target_type: 'developer_app', target_id: DbAdapter.getId(app) },
            order: [['created_at', 'DESC']], limit: pageSize, offset
        });
        const list = rows.map(row => {
            const json = row.toJSON ? row.toJSON() : row;
            let details = {}; try { details = json.details ? JSON.parse(json.details) : {}; } catch (_) {}
            return { id: json.id, action: json.action, ...details, ip_address: json.ip_address, user_agent: json.user_agent, created_at: json.created_at };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) { console.error('listMyAppCalls', e); return errorResponse(res, '获取调用记录失败', 500); }
}

async function adminListAppCalls(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(OperationLog, {
            where: { action: { [Op.in]: ['developer_api_call', 'developer_api_fail'] }, target_type: 'developer_app', target_id: DbAdapter.getId(app) },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset
        });
        const list = rows.map(row => {
            const json = row.toJSON ? row.toJSON() : row;
            let details = {};
            try { details = json.details ? JSON.parse(json.details) : {}; } catch (_) { details = {}; }
            return { id: json.id, ...details, ip_address: json.ip_address, user_agent: json.user_agent, created_at: json.created_at };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error('adminListAppCalls', e);
        return errorResponse(res, '获取应用调用记录失败', 500);
    }
}

async function adminReviewApp(req, res) {
    try {
        const { action, note } = req.body || {};
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);

        const map = {
            approve: 'active',
            reject: 'rejected',
            suspend: 'suspended'
        };
        if (!map[action]) return errorResponse(res, '无效的审核操作', 400);
        const cleanNote = note != null ? String(note).trim() : '';
        if (action === 'reject' && cleanNote.length < 5) return errorResponse(res, '拒绝审核必须填写至少5字的整改建议', 400);

        await DbAdapter.update(DeveloperApp, {
            status: map[action],
            review_note: cleanNote || app.review_note,
            reviewed_by: getOwnerId(req),
            reviewed_at: new Date()
        }, { where: { id: app.id } });

        if (action === 'suspend' || action === 'reject') {
            const now = new Date();
            await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
            await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
        }

        logOperation(req, 'review_developer_app', 'developer_app', app.id, { action, note });
        await recordAppAudit(app.id, getOwnerId(req), { action: 'review_' + action, fromStatus: app.status, toStatus: map[action], reviewNote: note != null ? String(note).trim() : null });
        if (action === 'reject') {
            await createNotification({ user_id: app.owner_user_id, type: 'developer_app_review', title: '开发者应用审核未通过', content: `应用「${app.name}」未通过审核。整改建议：${cleanNote}`, related_id: app.id, related_type: 'developer_app', sender_id: getOwnerId(req), meta: JSON.stringify({ action: 'reject', app_id: app.id }) });
        }
        const updated = await DbAdapter.findByPk(DeveloperApp, app.id);
        return successResponse(res, serializeApp(updated), '审核完成');
    } catch (e) {
        console.error('adminReviewApp', e);
        return errorResponse(res, '审核失败', 500);
    }
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function recordAppAudit(appId, actorUserId, fields) {
  try {
    await DeveloperAppAuditLog.create({
      app_id: appId,
      actor_user_id: actorUserId || null,
      action: fields.action,
      from_status: fields.fromStatus || null,
      to_status: fields.toStatus || null,
      review_note: fields.reviewNote || null,
      rate_limit_before: fields.rateLimitBefore ?? null,
      rate_limit_after: fields.rateLimitAfter ?? null,
      meta: fields.meta ? JSON.stringify(fields.meta) : null
    });
  } catch (err) {
    console.error('[DeveloperController] audit log write failed:', err.message);
  }
}

async function adminUpdateAppRateLimit(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        if (!req.body || req.body.rate_limit_per_min === undefined) return errorResponse(res, '缺少 rate_limit_per_min', 400);
        const newLimit = clampInt(req.body.rate_limit_per_min, 1, 10000, app.rate_limit_per_min);
        const before = app.rate_limit_per_min;
        await DbAdapter.update(DeveloperApp, { rate_limit_per_min: newLimit }, { where: { id: app.id } });
        await recordAppAudit(app.id, getOwnerId(req), { action: 'rate_limit_change', rateLimitBefore: before, rateLimitAfter: newLimit });
        logOperation(req, 'update_developer_app_rate_limit', 'developer_app', app.id, { before, after: newLimit });
        const updated = await DbAdapter.findByPk(DeveloperApp, app.id);
        return successResponse(res, serializeApp(updated), '限流已更新');
    } catch (e) {
        console.error('adminUpdateAppRateLimit', e);
        return errorResponse(res, '更新限流失败', 500);
    }
}

async function adminRevokeAllTokens(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const now = new Date();
        const [accessCount] = await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
        const [refreshCount] = await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
        await recordAppAudit(app.id, getOwnerId(req), { action: 'revoke_all_tokens', meta: { accessCount, refreshCount } });
        logOperation(req, 'revoke_developer_app_tokens', 'developer_app', app.id, { accessCount, refreshCount });
        return successResponse(res, { accessCount, refreshCount }, '令牌已撤销');
    } catch (e) {
        console.error('adminRevokeAllTokens', e);
        return errorResponse(res, '撤销令牌失败', 500);
    }
}

async function adminRegenerateSecret(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const plainSecret = oauth.randomToken('sk_', 24);
        const clientSecretHash = await oauth.hashSecret(plainSecret);
        await DbAdapter.update(DeveloperApp, { client_secret_hash: clientSecretHash }, { where: { id: app.id } });
        const now = new Date();
        await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
        await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
        await recordAppAudit(app.id, getOwnerId(req), { action: 'rotate_secret' });
        logOperation(req, 'rotate_developer_app_secret_admin', 'developer_app', app.id, {});
        return successResponse(res, {
            client_id: app.client_id,
            client_secret: plainSecret,
            client_secret_notice: '请立即保存 client_secret，关闭后无法再次查看明文'
        }, '密钥已重置，旧令牌已失效');
    } catch (e) {
        console.error('adminRegenerateSecret', e);
        return errorResponse(res, '重置密钥失败', 500);
    }
}

async function adminDeleteApp(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const appId = DbAdapter.getId(app);
        await recordAppAudit(appId, getOwnerId(req), { action: 'delete_app', fromStatus: app.status });
        await OAuthAccessToken.destroy({ where: { app_id: appId } });
        await OAuthRefreshToken.destroy({ where: { app_id: appId } });
        await OAuthAuthCode.destroy({ where: { app_id: appId } });
        await UserAppAuthorization.destroy({ where: { app_id: appId } });
        await DeveloperAppAuditLog.destroy({ where: { app_id: appId } });
        await app.destroy();
        logOperation(req, 'delete_developer_app', 'developer_app', appId, {});
        return successResponse(res, null, '应用已删除');
    } catch (e) {
        console.error('adminDeleteApp', e);
        return errorResponse(res, '删除应用失败', 500);
    }
}

async function adminListAuditLogs(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const appId = DbAdapter.getId(app);
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const where = { app_id: appId };
        if (req.query.action) where.action = String(req.query.action).trim();
        const { count, rows } = await DbAdapter.findAndCountAll(DeveloperAppAuditLog, {
            where,
            order: [['id', 'DESC']],
            limit: pageSize,
            offset,
            include: [{ model: User, as: 'actor', attributes: ['id', 'username', 'nickname'], required: false }]
        });
        const list = rows.map(row => {
            const json = row.toJSON ? row.toJSON() : row;
            let meta = null;
            try { meta = json.meta ? JSON.parse(json.meta) : null; } catch (_) { meta = null; }
            return {
                id: json.id, action: json.action,
                from_status: json.from_status, to_status: json.to_status,
                review_note: json.review_note,
                rate_limit_before: json.rate_limit_before, rate_limit_after: json.rate_limit_after,
                actor: json.actor || null, meta,
                created_at: json.created_at
            };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error('adminListAuditLogs', e);
        return errorResponse(res, '获取审核历史失败', 500);
    }
}

async function adminCallLogStats(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const appId = DbAdapter.getId(app);
        const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [total, fails, last30d] = await Promise.all([
            DbAdapter.count(OperationLog, { where: { action: 'developer_api_call', target_type: 'developer_app', target_id: appId } }),
            DbAdapter.count(OperationLog, { where: { action: 'developer_api_fail', target_type: 'developer_app', target_id: appId } }),
            DbAdapter.count(OperationLog, { where: { action: 'developer_api_call', target_type: 'developer_app', target_id: appId, created_at: { [Op.gte]: since30 } } })
        ]);
        return successResponse(res, { total, fails, last30d });
    } catch (e) {
        console.error('adminCallLogStats', e);
        return errorResponse(res, '获取调用统计失败', 500);
    }
}

async function adminCallLogStatsDetail(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const appId = DbAdapter.getId(app);
        const days = clampInt(req.query && req.query.days, 1, 90, 14);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const rows = await OperationLog.findAll({
            where: { action: 'developer_api_call', target_type: 'developer_app', target_id: appId, created_at: { [Op.gte]: since } },
            attributes: ['id', 'details', 'created_at'],
            order: [['created_at', 'ASC']]
        });
        const perDay = {};
        const perPath = {};
        const perStatus = {};
        for (const row of rows) {
            const day = new Date(row.created_at).toISOString().slice(0, 10);
            perDay[day] = (perDay[day] || 0) + 1;
            let path = '-';
            let status = 0;
            try {
                const meta = row.details ? JSON.parse(row.details) : {};
                path = meta.path || '-';
                status = meta.status || 0;
            } catch (_) {}
            perPath[path] = (perPath[path] || 0) + 1;
            perStatus[String(status)] = (perStatus[String(status)] || 0) + 1;
        }
        return successResponse(res, { days, perDay, perPath, perStatus });
    } catch (e) {
        console.error('adminCallLogStatsDetail', e);
        return errorResponse(res, '获取调用分布失败', 500);
    }
}

// -------- OAuth --------
async function getAuthorizeInfo(req, res) {
    try {
        const { client_id, redirect_uri, scope, state, response_type } = req.query;
        if (response_type && response_type !== 'code') {
            return errorResponse(res, '仅支持 response_type=code', 400);
        }
        if (!client_id) return errorResponse(res, '缺少 client_id', 400);
        if (!redirect_uri) return errorResponse(res, '缺少 redirect_uri', 400);

        const app = await DbAdapter.findOne(DeveloperApp, { where: { client_id: String(client_id) } });
        if (!app || app.status !== 'active') return errorResponse(res, '应用不存在或未通过审核', 400);
        if (!oauth.matchRedirectUri(app.redirect_uris, redirect_uri)) {
            return errorResponse(res, 'redirect_uri 未登记', 400);
        }

        const requested = oauth.normalizeScopes(scope);
        const allowed = oauth.intersectScopes(requested.length ? requested : oauth.parseJsonField(app.scopes_requested, []), oauth.parseJsonField(app.scopes_requested, []));
        if (allowed.length === 0) return errorResponse(res, '无效的 scope', 400);

        return successResponse(res, {
            app: {
                id: app.id,
                name: app.name,
                description: app.description,
                logo_url: app.logo_url,
                homepage_url: app.homepage_url,
                client_id: app.client_id
            },
            scopes: allowed.map(key => ({
                key,
                ...(oauth.ALL_SCOPES[key] || { name: key, description: '' })
            })),
            redirect_uri: String(redirect_uri),
            state: state || null
        });
    } catch (e) {
        console.error('getAuthorizeInfo', e);
        return errorResponse(res, '获取授权信息失败', 500);
    }
}

async function approveAuthorize(req, res) {
    try {
        const { client_id, redirect_uri, scope, state, approved } = req.body || {};
        if (!client_id || !redirect_uri) return errorResponse(res, '参数不完整', 400);

        const app = await DbAdapter.findOne(DeveloperApp, { where: { client_id: String(client_id) } });
        if (!app || app.status !== 'active') return errorResponse(res, '应用不存在或未通过审核', 400);
        if (!oauth.matchRedirectUri(app.redirect_uris, redirect_uri)) {
            return errorResponse(res, 'redirect_uri 未登记', 400);
        }

        if (approved === false || approved === 'false' || approved === 0) {
            const denyUrl = oauth.buildRedirectWithParams(redirect_uri, {
                error: 'access_denied',
                error_description: 'user_denied',
                state: state || undefined
            });
            return successResponse(res, { redirect_to: denyUrl }, '已拒绝');
        }

        const requested = oauth.normalizeScopes(scope);
        const allowed = oauth.intersectScopes(requested.length ? requested : oauth.parseJsonField(app.scopes_requested, []), oauth.parseJsonField(app.scopes_requested, []));
        if (allowed.length === 0) return errorResponse(res, '无效的 scope', 400);

        const userId = getOwnerId(req);
        const code = oauth.randomToken('ac_', 24);
        const expiresAt = new Date(Date.now() + oauth.AUTH_CODE_TTL_MS);

        await sequelize.transaction(async (t) => {
            await DbAdapter.create(OAuthAuthCode, {
                code,
                app_id: app.id,
                user_id: userId,
                redirect_uri: String(redirect_uri),
                scopes: oauth.stringifyJsonField(allowed),
                expires_at: expiresAt
            }, { transaction: t });

            const existing = await DbAdapter.findOne(UserAppAuthorization, {
                where: { user_id: userId, app_id: app.id, revoked_at: null },
                transaction: t
            });
            if (existing) {
                const merged = oauth.intersectScopes(oauth.normalizeScopes([
                    ...oauth.parseJsonField(existing.scopes, []),
                    ...allowed
                ]), oauth.parseJsonField(app.scopes_requested, []));
                await DbAdapter.update(UserAppAuthorization, {
                    scopes: oauth.stringifyJsonField(merged),
                    authorized_at: new Date()
                }, { where: { id: existing.id }, transaction: t });
            } else {
                await DbAdapter.create(UserAppAuthorization, {
                    user_id: userId,
                    app_id: app.id,
                    scopes: oauth.stringifyJsonField(allowed),
                    authorized_at: new Date()
                }, { transaction: t });
            }
        });

        const redirectTo = oauth.buildRedirectWithParams(redirect_uri, {
            code,
            state: state || undefined
        });
        return successResponse(res, { redirect_to: redirectTo, code_expires_in: 600 });
    } catch (e) {
        console.error('approveAuthorize', e);
        return errorResponse(res, '授权失败', 500);
    }
}

function extractClientCredentials(req) {
    const header = req.headers.authorization || '';
    const basic = String(header).match(/^Basic\s+(.+)$/i);
    if (basic) {
        try {
            const decoded = Buffer.from(basic[1], 'base64').toString('utf8');
            const idx = decoded.indexOf(':');
            if (idx >= 0) {
                return {
                    client_id: decoded.slice(0, idx),
                    client_secret: decoded.slice(idx + 1)
                };
            }
        } catch (e) { /* ignore */ }
    }
    return {
        client_id: req.body?.client_id,
        client_secret: req.body?.client_secret
    };
}

async function issueTokens(app, userId, scopes, transaction) {
    const accessToken = oauth.randomToken('atk_', 24);
    const refreshToken = oauth.randomToken('rtk_', 24);
    const now = Date.now();
    await DbAdapter.create(OAuthAccessToken, {
        token_hash: oauth.hashToken(accessToken),
        app_id: app.id,
        user_id: userId,
        scopes: oauth.stringifyJsonField(scopes),
        expires_at: new Date(now + oauth.ACCESS_TOKEN_TTL_MS)
    }, transaction ? { transaction } : {});
    await DbAdapter.create(OAuthRefreshToken, {
        token_hash: oauth.hashToken(refreshToken),
        app_id: app.id,
        user_id: userId,
        scopes: oauth.stringifyJsonField(scopes),
        expires_at: new Date(now + oauth.REFRESH_TOKEN_TTL_MS)
    }, transaction ? { transaction } : {});
    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: Math.floor(oauth.ACCESS_TOKEN_TTL_MS / 1000),
        refresh_token: refreshToken,
        scope: scopes.join(' ')
    };
}

async function tokenEndpoint(req, res) {
    try {
        const grantType = req.body?.grant_type;
        const { client_id, client_secret } = extractClientCredentials(req);
        if (!client_id || !client_secret) return errorResponse(res, '缺少客户端凭证', 401, 'invalid_client');

        const app = await DbAdapter.findOne(DeveloperApp, { where: { client_id: String(client_id) } });
        if (!app || app.status !== 'active') return errorResponse(res, '客户端无效', 401, 'invalid_client');
        const secretOk = await oauth.verifySecret(client_secret, app.client_secret_hash);
        if (!secretOk) return errorResponse(res, '客户端密钥错误', 401, 'invalid_client');

        if (grantType === 'authorization_code') {
            const { code, redirect_uri } = req.body || {};
            if (!code || !redirect_uri) return errorResponse(res, '缺少 code 或 redirect_uri', 400, 'invalid_request');

            const authCode = await DbAdapter.findOne(OAuthAuthCode, { where: { code: String(code) } });
            if (!authCode || authCode.app_id !== app.id) return errorResponse(res, '授权码无效', 400, 'invalid_grant');
            if (authCode.used_at) return errorResponse(res, '授权码已使用', 400, 'invalid_grant');
            if (new Date(authCode.expires_at).getTime() <= Date.now()) return errorResponse(res, '授权码已过期', 400, 'invalid_grant');
            if (authCode.redirect_uri !== String(redirect_uri)) return errorResponse(res, 'redirect_uri 不匹配', 400, 'invalid_grant');

            const activeAuthorization = await DbAdapter.findOne(UserAppAuthorization, {
                where: { user_id: authCode.user_id, app_id: app.id, revoked_at: null }
            });
            if (!activeAuthorization) {
                return errorResponse(res, '用户授权已撤销，请重新授权', 400, 'invalid_grant');
            }
            const scopes = oauth.intersectScopes(
                oauth.intersectScopes(
                    oauth.parseJsonField(authCode.scopes, []),
                    oauth.parseJsonField(app.scopes_requested, [])
                ),
                oauth.parseJsonField(activeAuthorization.scopes, [])
            );
            if (scopes.length === 0) {
                return errorResponse(res, '授权权限已失效，请重新授权', 400, 'invalid_grant');
            }
            const tokens = await sequelize.transaction(async (t) => {
                await DbAdapter.update(OAuthAuthCode, { used_at: new Date() }, { where: { id: authCode.id }, transaction: t });
                return issueTokens(app, authCode.user_id, scopes, t);
            });
            return successResponse(res, tokens, 'ok');
        }

        if (grantType === 'refresh_token') {
            const { refresh_token } = req.body || {};
            if (!refresh_token) return errorResponse(res, '缺少 refresh_token', 400, 'invalid_request');
            const hash = oauth.hashToken(refresh_token);
            const old = await DbAdapter.findOne(OAuthRefreshToken, {
                where: {
                    token_hash: hash,
                    app_id: app.id,
                    revoked_at: null,
                    expires_at: { [Op.gt]: new Date() }
                }
            });
            if (!old) return errorResponse(res, 'refresh_token 无效', 400, 'invalid_grant');

            const activeAuthorization = await DbAdapter.findOne(UserAppAuthorization, {
                where: { user_id: old.user_id, app_id: app.id, revoked_at: null }
            });
            if (!activeAuthorization) {
                await DbAdapter.update(OAuthRefreshToken, { revoked_at: new Date() }, { where: { id: old.id } });
                return errorResponse(res, '用户授权已撤销，请重新授权', 400, 'invalid_grant');
            }
            const scopes = oauth.intersectScopes(
                oauth.intersectScopes(
                    oauth.parseJsonField(old.scopes, []),
                    oauth.parseJsonField(app.scopes_requested, [])
                ),
                oauth.parseJsonField(activeAuthorization.scopes, [])
            );
            if (scopes.length === 0) {
                await DbAdapter.update(OAuthRefreshToken, { revoked_at: new Date() }, { where: { id: old.id } });
                return errorResponse(res, '授权权限已失效，请重新授权', 400, 'invalid_grant');
            }
            const tokens = await sequelize.transaction(async (t) => {
                const issued = await issueTokens(app, old.user_id, scopes, t);
                // mark old refresh revoked; store replaced_by if we can find new one
                const newHash = oauth.hashToken(issued.refresh_token);
                const newRow = await DbAdapter.findOne(OAuthRefreshToken, { where: { token_hash: newHash }, transaction: t });
                await DbAdapter.update(OAuthRefreshToken, {
                    revoked_at: new Date(),
                    replaced_by: newRow ? newRow.id : null
                }, { where: { id: old.id }, transaction: t });
                // optional: revoke access tokens for this app+user older ones? keep short-lived access
                return issued;
            });
            return successResponse(res, tokens, 'ok');
        }

        return errorResponse(res, '不支持的 grant_type', 400, 'unsupported_grant_type');
    } catch (e) {
        console.error('tokenEndpoint', e);
        return errorResponse(res, '换取 token 失败', 500);
    }
}

async function revokeToken(req, res) {
    try {
        const token = req.body?.token || req.body?.access_token || req.body?.refresh_token;
        if (!token) return errorResponse(res, '缺少 token', 400);
        const hash = oauth.hashToken(token);
        const now = new Date();
        await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { token_hash: hash, revoked_at: null } });
        await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { token_hash: hash, revoked_at: null } });
        return successResponse(res, null, '已撤销');
    } catch (e) {
        console.error('revokeToken', e);
        return errorResponse(res, '撤销失败', 500);
    }
}

async function userinfo(req, res) {
    try {
        const user = req.oauth.user;
        const result = {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatar: user.avatar,
            bio: user.bio,
            level: user.level,
            follower_count: user.follower_count,
            following_count: user.following_count,
            work_count: user.work_count
        };
        const scopes = oauth.parseJsonField(req.oauth?.scopes, req.oauth?.scopes || []);
        if (Array.isArray(scopes) && scopes.includes('profile:email:read')) result.email = user.email || null;
        return successResponse(res, result);
    } catch (e) {
        return errorResponse(res, '获取用户信息失败', 500);
    }
}

// Open API
async function openMe(req, res) {
    return userinfo(req, res);
}

async function openMyWorks(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(Work, {
            where: { user_id: req.oauth.userId, status: 'published' },
            attributes: ['id', 'codemao_work_id', 'name', 'description', 'preview', 'type', 'ide_type', 'view_times', 'praise_times', 'collection_times', 'comment_count', 'created_at'],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset
        });
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (e) {
        console.error('openMyWorks', e);
        return errorResponse(res, '获取作品失败', 500);
    }
}

async function openMyWorkDetail(req, res) {
    try {
        const work = await DbAdapter.findOne(Work, {
            where: {
                user_id: req.oauth.userId,
                status: 'published',
                [Op.or]: [
                    { id: req.params.id },
                    { codemao_work_id: String(req.params.id) }
                ]
            },
            attributes: ['id', 'codemao_work_id', 'name', 'description', 'preview', 'type', 'ide_type', 'work_url', 'view_times', 'praise_times', 'collection_times', 'comment_count', 'created_at', 'updated_at']
        });
        if (!work) return errorResponse(res, '作品不存在', 404);
        return successResponse(res, work);
    } catch (e) {
        console.error('openMyWorkDetail', e);
        return errorResponse(res, '获取作品失败', 500);
    }
}

async function openMyComments(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(Comment, {
            where: { user_id: req.oauth.userId, status: 'active' },
            attributes: ['id', 'content', 'work_id', 'post_id', 'parent_id', 'like_count', 'created_at'],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset
        });
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (e) {
        console.error('openMyComments', e);
        return errorResponse(res, '获取评论失败', 500);
    }
}

async function openMyPosts(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(Post, {
            where: {
                user_id: req.oauth.userId,
                status: { [Op.in]: ['published', 'active'] }
            },
            attributes: ['id', 'title', 'content', 'view_count', 'like_count', 'comment_count', 'is_top', 'is_essence', 'created_at'],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset
        });
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (e) {
        console.error('openMyPosts', e);
        return errorResponse(res, '获取帖子失败', 500);
    }
}

async function openMyPostDetail(req, res) {
    try {
        const post = await DbAdapter.findOne(Post, {
            where: {
                id: req.params.id,
                user_id: req.oauth.userId,
                status: { [Op.in]: ['published', 'active'] }
            },
            attributes: ['id', 'title', 'content', 'view_count', 'like_count', 'comment_count', 'is_top', 'is_essence', 'created_at', 'updated_at']
        });
        if (!post) return errorResponse(res, '帖子不存在', 404);
        return successResponse(res, post);
    } catch (e) {
        console.error('openMyPostDetail', e);
        return errorResponse(res, '获取帖子失败', 500);
    }
}


// -------- Studios (studios:read / studios:review) --------
async function openMyStudios(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(StudioMember, {
            where: { user_id: req.oauth.userId, status: "active" },
            include: [{
                model: Studio,
                as: "studio",
                where: req.query.status ? { status: String(req.query.status) } : undefined,
                required: true,
                include: [
                    { model: User, as: "owner", attributes: ["id", "username", "nickname", "avatar"] }
                ]
            }],
            order: [["created_at", "DESC"]],
            limit: pageSize,
            offset
        });
        const list = rows.map(r => {
            const json = r.toJSON ? r.toJSON() : r;
            const s = json.studio || {};
            return {
                member_id: json.id,
                member_role: json.role,
                member_status: json.status,
                member_joined_at: json.created_at,
                studio: {
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    logo_url: s.logo_url,
                    cover_url: s.cover_url,
                    status: s.status,
                    member_count: s.member_count,
                    work_count: s.work_count,
                    owner: s.owner || null,
                    created_at: s.created_at,
                    updated_at: s.updated_at
                }
            };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error("openMyStudios", e);
        return errorResponse(res, "Failed to get studios", 500);
    }
}

async function openMyStudioDetail(req, res) {
    try {
        const member = await DbAdapter.findOne(StudioMember, {
            where: { user_id: req.oauth.userId, studio_id: req.params.id, status: "active" },
            include: [{
                model: Studio,
                as: "studio",
                include: [
                    { model: User, as: "owner", attributes: ["id", "username", "nickname", "avatar"] }
                ]
            }]
        });
        if (!member) return errorResponse(res, "Not found", 404);
        const json = member.toJSON ? member.toJSON() : member;
        const s = json.studio || {};
        const members = await DbAdapter.count(StudioMember, { where: { studio_id: s.id, status: "active" } });
        const works = await DbAdapter.count(StudioWork, { where: { studio_id: s.id, status: "approved" } });
        return successResponse(res, {
            id: s.id, name: s.name, description: s.description,
            logo_url: s.logo_url, cover_url: s.cover_url, status: s.status,
            member_count: members, work_count: works,
            owner: s.owner || null, my_role: json.role,
            created_at: s.created_at, updated_at: s.updated_at
        });
    } catch (e) {
        console.error("openMyStudioDetail", e);
        return errorResponse(res, "Failed to get studio", 500);
    }
}

async function openMyFollowers(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(Follow, {
            where: { following_id: req.oauth.userId },
            include: [{ model: User, as: "follower", attributes: ["id", "username", "nickname", "avatar", "bio", "level"] }],
            order: [["created_at", "DESC"]],
            limit: pageSize, offset
        });
        const list = rows.map(r => {
            const json = r.toJSON ? r.toJSON() : r;
            return { ...(json.follower || {}), followed_at: json.created_at };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error("openMyFollowers", e);
        return errorResponse(res, "Failed to get followers", 500);
    }
}

async function openMyFollowing(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(Follow, {
            where: { follower_id: req.oauth.userId },
            include: [{ model: User, as: "following", attributes: ["id", "username", "nickname", "avatar", "bio", "level"] }],
            order: [["created_at", "DESC"]],
            limit: pageSize, offset
        });
        const list = rows.map(r => {
            const json = r.toJSON ? r.toJSON() : r;
            return { ...(json.following || {}), followed_at: json.created_at };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error("openMyFollowing", e);
        return errorResponse(res, "Failed to get following", 500);
    }
}

async function openMyFavorites(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(Favorite, {
            where: { user_id: req.oauth.userId },
            order: [["created_at", "DESC"]],
            limit: pageSize, offset
        });
        const workIds = rows.map(r => r.work_id).filter(Boolean);
        const postIds = rows.map(r => r.post_id).filter(Boolean);
        const works = workIds.length
            ? await DbAdapter.findAll(Work, { where: { id: { [Op.in]: workIds }, status: "published" }, attributes: ["id", "name", "preview", "user_id", "created_at"] })
            : [];
        const posts = postIds.length
            ? await DbAdapter.findAll(Post, { where: { id: { [Op.in]: postIds }, status: { [Op.in]: ["published", "active"] } }, attributes: ["id", "title", "user_id", "created_at"] })
            : [];
        const workMap = new Map(works.map(w => [DbAdapter.getId(w), w]));
        const postMap = new Map(posts.map(p => [DbAdapter.getId(p), p]));
        const list = rows.map(r => {
            if (r.work_id) { const w = workMap.get(r.work_id); return w ? { type: "work", target_id: r.work_id, created_at: r.created_at, target: w } : null; }
            if (r.post_id) { const p = postMap.get(r.post_id); return p ? { type: "post", target_id: r.post_id, created_at: r.created_at, target: p } : null; }
            return null;
        }).filter(Boolean);
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error("openMyFavorites", e);
        return errorResponse(res, "Failed to get favorites", 500);
    }
}

async function openMyLikes(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(Like, {
            where: { user_id: req.oauth.userId },
            order: [["created_at", "DESC"]],
            limit: pageSize, offset
        });
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (e) {
        console.error("openMyLikes", e);
        return errorResponse(res, "Failed to get likes", 500);
    }
}

// -------- Extended read/write scopes --------
function attachOAuthUser(req) {
    req.user = req.oauth.user;
    return req;
}

async function openMyNotifications(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const where = { user_id: req.oauth.userId };
        if (req.query.unread === 'true' || req.query.unread === '1') where.is_read = false;
        const { count, rows } = await DbAdapter.findAndCountAll(Notification, {
            where,
            attributes: ['id', 'type', 'title', 'content', 'related_id', 'related_type', 'sender_id', 'is_read', 'created_at'],
            order: [['created_at', 'DESC']], limit: pageSize, offset
        });
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (e) {
        console.error('openMyNotifications', e);
        return errorResponse(res, '获取通知失败', 500);
    }
}

async function openSendNotification(req, res) {
    try {
        const title = req.body && req.body.title != null ? String(req.body.title).trim() : '';
        const content = req.body && req.body.content != null ? String(req.body.content).trim() : '';
        if (!title) return errorResponse(res, '通知标题不能为空', 400);
        if (title.length > 200) return errorResponse(res, '通知标题不能超过200字', 400);
        if (content.length > 5000) return errorResponse(res, '通知内容不能超过5000字', 400);
        const notification = await DbAdapter.create(Notification, {
            user_id: req.oauth.userId,
            sender_id: req.oauth.userId,
            type: 'developer_app',
            title,
            content: content || null,
            related_type: 'developer_app',
            related_id: req.oauth.appId,
            meta: JSON.stringify({ app_id: req.oauth.appId, app_name: req.oauth.app && req.oauth.app.name })
        });
        return successResponse(res, notification, '通知已发送');
    } catch (e) {
        console.error('openSendNotification', e);
        return errorResponse(res, '发送通知失败', 500);
    }
}

async function openMyWorkStats(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const where = { user_id: req.oauth.userId, status: { [Op.ne]: 'deleted' } };
        if (req.params.id) where.id = req.params.id;
        const { count, rows } = await DbAdapter.findAndCountAll(Work, {
            where,
            attributes: ['id', 'codemao_work_id', 'name', 'status', 'view_times', 'praise_times', 'collection_times', 'comment_count', 'created_at', 'updated_at'],
            order: [['created_at', 'DESC']],
            limit: req.params.id ? 1 : pageSize,
            offset: req.params.id ? 0 : offset
        });
        if (req.params.id) {
            if (!rows.length) return errorResponse(res, '作品不存在', 404);
            return successResponse(res, rows[0]);
        }
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (e) {
        console.error('openMyWorkStats', e);
        return errorResponse(res, '获取作品统计失败', 500);
    }
}

async function openMyActivity(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const fetchLimit = Math.min(offset + pageSize, 500);
        const [works, posts, comments, workCount, postCount, commentCount] = await Promise.all([
            DbAdapter.findAll(Work, { where: { user_id: req.oauth.userId, status: 'published' }, attributes: ['id', 'name', 'preview', 'created_at'], order: [['created_at', 'DESC']], limit: fetchLimit }),
            DbAdapter.findAll(Post, { where: { user_id: req.oauth.userId, status: 'published' }, attributes: ['id', 'title', 'category', 'created_at'], order: [['created_at', 'DESC']], limit: fetchLimit }),
            DbAdapter.findAll(Comment, { where: { user_id: req.oauth.userId, status: 'active' }, attributes: ['id', 'content', 'work_id', 'post_id', 'created_at'], order: [['created_at', 'DESC']], limit: fetchLimit }),
            DbAdapter.count(Work, { where: { user_id: req.oauth.userId, status: 'published' } }),
            DbAdapter.count(Post, { where: { user_id: req.oauth.userId, status: 'published' } }),
            DbAdapter.count(Comment, { where: { user_id: req.oauth.userId, status: 'active' } })
        ]);
        const activity = [
            ...works.map(row => ({ type: 'work', created_at: row.created_at, data: row })),
            ...posts.map(row => ({ type: 'post', created_at: row.created_at, data: row })),
            ...comments.map(row => ({ type: 'comment', created_at: row.created_at, data: row }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(offset, offset + pageSize);
        // 活动聚合最多回溯 500 条，避免高页码导致一次加载大量三表数据。
        const total = Math.min(workCount + postCount + commentCount, 500);
        return paginateResponse(res, activity, total, page, pageSize);
    } catch (e) {
        console.error('openMyActivity', e);
        return errorResponse(res, '获取社区动态失败', 500);
    }
}

async function openMyStudioMembers(req, res) {
    try {
        const mine = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: req.params.id, user_id: req.oauth.userId, status: 'active' }
        });
        if (!mine) return errorResponse(res, '工作室不存在或无权查看', 404);
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const { count, rows } = await DbAdapter.findAndCountAll(StudioMember, {
            where: { studio_id: req.params.id, status: 'active' },
            include: [{ model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar', 'bio', 'level'] }],
            attributes: ['id', 'role', 'joined_at'],
            order: [['joined_at', 'ASC']], limit: pageSize, offset
        });
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (e) {
        console.error('openMyStudioMembers', e);
        return errorResponse(res, '获取工作室成员失败', 500);
    }
}

function requireOAuthAdminPermission(permission) {
    return async (req, res, callback) => {
        const role = req.oauth && req.oauth.user && req.oauth.user.role;
        if (!role || !hasPermission(role, permission)) {
            return errorResponse(res, `授权用户缺少后台权限: ${permission}`, 403, 'oauth_forbidden_role');
        }
        attachOAuthUser(req);
        return callback(req, res);
    };
}

const openReports = (req, res) => requireOAuthAdminPermission('report:view')(req, res, adminController.getReports);
const openHandleReport = (req, res) => {
    req.params.reportId = req.params.id;
    return requireOAuthAdminPermission('report:handle')(req, res, adminController.handleReport);
};

async function withOwnedResource(req, res, model, where, label, callback) {
    try {
        const owned = await DbAdapter.findOne(model, { where });
        if (!owned) return errorResponse(res, `${label}不存在`, 404);
        return callback();
    } catch (e) {
        console.error(`open owned ${label} operation`, e);
        return errorResponse(res, `${label}操作失败`, 500);
    }
}

const openCreateComment = (req, res) => commentController.createComment(attachOAuthUser(req), res);
const openDeleteComment = (req, res) => withOwnedResource(
    req, res, Comment, { id: req.params.id, user_id: req.oauth.userId }, '评论',
    () => commentController.deleteComment(attachOAuthUser(req), res)
);
const openCreatePost = (req, res) => postController.createPost(attachOAuthUser(req), res);
const openUpdatePost = (req, res) => withOwnedResource(
    req, res, Post, { id: req.params.id, user_id: req.oauth.userId, status: { [Op.ne]: 'deleted' } }, '帖子',
    () => postController.updatePost(attachOAuthUser(req), res)
);
const openDeletePost = (req, res) => withOwnedResource(
    req, res, Post, { id: req.params.id, user_id: req.oauth.userId, status: { [Op.ne]: 'deleted' } }, '帖子',
    () => postController.deletePost(attachOAuthUser(req), res)
);
const openPublishWork = (req, res) => workController.publishWork(attachOAuthUser(req), res);
const openUpdateWork = (req, res) => withOwnedResource(
    req, res, Work,
    { codemao_work_id: String(req.params.id), user_id: req.oauth.userId, status: { [Op.ne]: 'deleted' } },
    '作品', () => { req.params.codemaoId = req.params.id; return workController.updateWork(attachOAuthUser(req), res); }
);
const openDeleteWork = (req, res) => withOwnedResource(
    req, res, Work,
    { codemao_work_id: String(req.params.id), user_id: req.oauth.userId, status: { [Op.ne]: 'deleted' } },
    '作品', () => { req.params.codemaoId = req.params.id; return workController.deleteWork(attachOAuthUser(req), res); }
);

async function assertCanReview(req, res) {
    const role = req.oauth && req.oauth.user ? req.oauth.user.role : null;
    if (!["admin", "superadmin"].includes(role)) {
        return errorResponse(res, "Admin role required", 403, "oauth_forbidden_role");
    }
    return null;
}

async function openStudiosPendingReview(req, res) {
    try {
        const denied = await assertCanReview(req, res);
        if (denied) return denied;
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const where = { status: "pending" };
        if (req.query.keyword) where.name = { [Op.like]: "%" + String(req.query.keyword).trim() + "%" };
        const { count, rows } = await DbAdapter.findAndCountAll(Studio, {
            where,
            include: [{ model: User, as: "owner", attributes: ["id", "username", "nickname", "avatar"] }],
            order: [["created_at", "ASC"]],
            limit: pageSize, offset
        });
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (e) {
        console.error("openStudiosPendingReview", e);
        return errorResponse(res, "Failed to get pending studios", 500);
    }
}

async function openReviewStudio(req, res) {
    try {
        const denied = await assertCanReview(req, res);
        if (denied) return denied;
        const { action, note } = req.body || {};
        if (!["approve", "reject", "ban"].includes(action)) return errorResponse(res, "Invalid action", 400);
        const statusMap = { approve: "active", reject: "rejected", ban: "banned" };
        const studio = await DbAdapter.findByPk(Studio, req.params.id);
        if (!studio) return errorResponse(res, "Not found", 404);
        if (studio.status !== "pending") return errorResponse(res, "Only pending studios can be reviewed", 400);
        await DbAdapter.update(Studio, {
            status: statusMap[action],
            review_note: note != null ? String(note).trim() : null,
            reviewed_by: req.oauth.userId,
            reviewed_at: new Date()
        }, { where: { id: studio.id } });
        logOperation(req, "review_studio", "studio", studio.id, { action, note });
        const updated = await DbAdapter.findByPk(Studio, studio.id);
        return successResponse(res, {
            id: updated.id, name: updated.name, status: updated.status,
            review_note: updated.review_note, reviewed_at: updated.reviewed_at
        }, "Review done");
    } catch (e) {
        console.error("openReviewStudio", e);
        return errorResponse(res, "Review failed", 500);
    }
}

// User authorized apps
async function listMyAuthorizations(req, res) {
    try {
        const rows = await DbAdapter.findAll(UserAppAuthorization, {
            where: { user_id: getOwnerId(req), revoked_at: null },
            include: [{ model: DeveloperApp, as: 'app' }],
            order: [['authorized_at', 'DESC']]
        });
        const list = rows.map(r => {
            const json = r.toJSON ? r.toJSON() : r;
            return {
                id: json.id,
                scopes: oauth.parseJsonField(json.scopes, []),
                authorized_at: json.authorized_at,
                app: json.app ? {
                    id: json.app.id,
                    name: json.app.name,
                    description: json.app.description,
                    logo_url: json.app.logo_url,
                    homepage_url: json.app.homepage_url,
                    client_id: json.app.client_id,
                    status: json.app.status
                } : null
            };
        }).filter(x => x.app);
        return successResponse(res, list);
    } catch (e) {
        console.error('listMyAuthorizations', e);
        return errorResponse(res, '获取授权列表失败', 500);
    }
}

async function revokeMyAuthorization(req, res) {
    try {
        const auth = await DbAdapter.findOne(UserAppAuthorization, {
            where: { id: req.params.id, user_id: getOwnerId(req), revoked_at: null }
        });
        if (!auth) return errorResponse(res, '授权记录不存在', 404);
        const now = new Date();
        await sequelize.transaction(async (t) => {
            await DbAdapter.update(UserAppAuthorization, { revoked_at: now }, { where: { id: auth.id }, transaction: t });
            await DbAdapter.destroy(OAuthAuthCode, {
                where: { user_id: auth.user_id, app_id: auth.app_id, used_at: null },
                transaction: t
            });
            await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, {
                where: { user_id: auth.user_id, app_id: auth.app_id, revoked_at: null },
                transaction: t
            });
            await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, {
                where: { user_id: auth.user_id, app_id: auth.app_id, revoked_at: null },
                transaction: t
            });
        });
        logOperation(req, 'revoke_app_authorization', 'user_app_authorization', auth.id, { app_id: auth.app_id });
        return successResponse(res, null, '已撤销授权');
    } catch (e) {
        console.error('revokeMyAuthorization', e);
        return errorResponse(res, '撤销失败', 500);
    }
}

module.exports = {
    listMyApps,
    getMyApp,
    listMyAppCalls,
    createApp,
    updateApp,
    uploadAppLogo,
    rotateSecret,
    getScopeDocs,
    adminListApps,
    adminGetApp,
    adminListAppCalls,
    adminReviewApp,
    getAuthorizeInfo,
    approveAuthorize,
    tokenEndpoint,
    revokeToken,
    userinfo,
    openMe,
    openMyWorks,
    openMyWorkDetail,
    openMyComments,
    openMyPosts,
    openMyPostDetail,
    listMyAuthorizations,
    revokeMyAuthorization,
    openMyStudios,
    openMyStudioDetail,
    openMyFollowers,
    openMyFollowing,
    openMyFavorites,
    openMyLikes,
    openStudiosPendingReview,
    openReviewStudio,
    openMyNotifications,
    openSendNotification,
    openMyWorkStats,
    openMyActivity,
    openMyStudioMembers,
    openReports,
    openHandleReport,
    openCreateComment,
    openDeleteComment,
    openCreatePost,
    openUpdatePost,
    openDeletePost,
    openPublishWork,
    openUpdateWork,
    openDeleteWork,
    adminUpdateAppRateLimit,
    adminRevokeAllTokens,
    adminRegenerateSecret,
    adminDeleteApp,
    adminListAuditLogs,
    adminCallLogStats,
    adminCallLogStatsDetail,
};

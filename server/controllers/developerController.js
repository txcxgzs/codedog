/**
 * Developer platform + OAuth2 controller
 */
const { Op } = require('sequelize');
const {
    User, Work, Comment, Post, DeveloperApp, OAuthAuthCode, OAuthAccessToken,
    OAuthRefreshToken, UserAppAuthorization, sequelize
} = require('../models');
const DbAdapter = require('../utils/dbAdapter');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { logOperation } = require('../middleware/operationLog');
const oauth = require('../utils/oauth');

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
            updateData.scopes_requested = oauth.stringifyJsonField(scopeList);
            sensitiveChanged = true;
        }

        if (sensitiveChanged && (app.status === 'active' || app.status === 'rejected')) {
            updateData.status = 'pending';
            updateData.review_note = null;
            updateData.reviewed_by = null;
            updateData.reviewed_at = null;
        }

        await DbAdapter.update(DeveloperApp, updateData, { where: { id: app.id } });
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
                owner_user_id: json.owner_user_id
            };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error('adminListApps', e);
        return errorResponse(res, '获取开发者应用失败', 500);
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

        await DbAdapter.update(DeveloperApp, {
            status: map[action],
            review_note: note != null ? String(note).trim() : app.review_note,
            reviewed_by: getOwnerId(req),
            reviewed_at: new Date()
        }, { where: { id: app.id } });

        if (action === 'suspend' || action === 'reject') {
            const now = new Date();
            await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
            await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
        }

        logOperation(req, 'review_developer_app', 'developer_app', app.id, { action, note });
        const updated = await DbAdapter.findByPk(DeveloperApp, app.id);
        return successResponse(res, serializeApp(updated), '审核完成');
    } catch (e) {
        console.error('adminReviewApp', e);
        return errorResponse(res, '审核失败', 500);
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
                const merged = oauth.normalizeScopes([
                    ...oauth.parseJsonField(existing.scopes, []),
                    ...allowed
                ]);
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

            const scopes = oauth.parseJsonField(authCode.scopes, []);
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

            const scopes = oauth.parseJsonField(old.scopes, []);
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
        return successResponse(res, {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatar: user.avatar,
            bio: user.bio,
            level: user.level,
            follower_count: user.follower_count,
            following_count: user.following_count,
            work_count: user.work_count
        });
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
    createApp,
    updateApp,
    rotateSecret,
    getScopeDocs,
    adminListApps,
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
    revokeMyAuthorization
};

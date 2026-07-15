const fs = require("fs");
const path = require("path");
const filePath = path.resolve(__dirname, "..", "server", "controllers", "developerController.js");

let s = fs.readFileSync(filePath, "utf8");
const NL = s.indexOf("\r\n") >= 0 ? "\r\n" : "\n";

function check(marker) {
  if (s.indexOf(marker) < 0) throw new Error("anchor not found: " + JSON.stringify(marker.slice(0, 80)));
}

// 1) imports: add DeveloperAppAuditLog + getDeveloperApiLogger
check("DeveloperApp, OAuthAuthCode, OAuthAccessToken,");
s = s.replace("DeveloperApp, OAuthAuthCode, OAuthAccessToken,", "DeveloperApp, DeveloperAppAuditLog, OAuthAuthCode, OAuthAccessToken,");
check("const oauth = require('../utils/oauth');");
s = s + ""; // noop
check(`const oauth = require('../utils/oauth');`);
s = s.replace(`const oauth = require('../utils/oauth');`, `const oauth = require('../utils/oauth');
const { getDeveloperApiLogger } = require('../services/developerApiLogger');
const openApiMiddleware = require('../middleware/developerOpenApi');`);

// 2) helper functions after serializeApp
check("function serializeApp(app, extra = {}) {\n    return Object.assign(oauth.publicAppView(app), extra);\n}\n");
const helpers = `
function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function recordAppAudit(appId, actorUserId, fields = {}) {
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
    console.error('[developerController] audit log write failed:', err.message);
  }
}
`;
s = s.replace("    return Object.assign(oauth.publicAppView(app), extra);\n}\n", "    return Object.assign(oauth.publicAppView(app), extra);\n}\n" + helpers);

// 3) enhance adminReviewApp to record audit log
check("        const now = new Date();\n        await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });\n        await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });\n    }\n\n    logOperation(req, 'review_developer_app', 'developer_app', app.id, { action, note });\n    const updated = await DbAdapter.findByPk(DeveloperApp, app.id);\n    return successResponse(res, serializeApp(updated), '审核完成');");
const reviewReplacement = `        const now = new Date();
        await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
        await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });
    }

    await recordAppAudit(app.id, getOwnerId(req), {
      action: 'review_' + action,
      fromStatus: app.status,
      toStatus: map[action],
      reviewNote: note != null ? String(note).trim() : app.review_note
    });

    logOperation(req, 'review_developer_app', 'developer_app', app.id, { action, note });
    const updated = await DbAdapter.findByPk(DeveloperApp, app.id);
    return successResponse(res, serializeApp(updated), '审核完成');`;
s = s.replace("        const now = new Date();\n        await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });\n        await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: app.id, revoked_at: null } });\n    }\n\n    logOperation(req, 'review_developer_app', 'developer_app', app.id, { action, note });\n    const updated = await DbAdapter.findByPk(DeveloperApp, app.id);\n    return successResponse(res, serializeApp(updated), '审核完成');", reviewReplacement);

// 4) insert new admin functions right before the OAuth section comment
check("// -------- OAuth --------");
const newAdmin = `
async function adminUpdateRateLimit(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const newLimit = clampInt(req.body && req.body.rate_limit_per_min, 1, 10000, app.rate_limit_per_min);
        const before = app.rate_limit_per_min;
        await DbAdapter.update(DeveloperApp, { rate_limit_per_min: newLimit }, { where: { id: app.id } });
        await recordAppAudit(app.id, getOwnerId(req), {
          action: 'rate_limit_change',
          rateLimitBefore: before,
          rateLimitAfter: newLimit,
          meta: { body: req.body || {} }
        });
        logOperation(req, 'update_developer_app_rate_limit', 'developer_app', app.id, { before, after: newLimit });
        const updated = await DbAdapter.findByPk(DeveloperApp, app.id);
        return successResponse(res, serializeApp(updated), '限流已更新');
    } catch (e) {
        console.error('[adminUpdateRateLimit]', e);
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
        await recordAppAudit(app.id, getOwnerId(req), {
          action: 'revoke_all_tokens',
          meta: { accessCount, refreshCount }
        });
        logOperation(req, 'revoke_developer_app_tokens', 'developer_app', app.id, { accessCount, refreshCount });
        return successResponse(res, { accessCount, refreshCount }, '令牌已撤销');
    } catch (e) {
        console.error('[adminRevokeAllTokens]', e);
        return errorResponse(res, '撤销令牌失败', 500);
    }
}

async function adminRegenerateSecret(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const plainSecret = oauth.randomToken('sk_', 24);
        const clientSecretHash = await oauth.hashSecret(plainSecret);
        const now = new Date();
        await DbAdapter.update(DeveloperApp, { client_secret_hash: clientSecretHash }, { where: { id: app.id } });
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
        console.error('[adminRegenerateSecret]', e);
        return errorResponse(res, '重置密钥失败', 500);
    }
}

async function adminDeleteApp(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const appId = DbAdapter.getId(app);
        const now = new Date();
        await OAuth.destroy({ where: { app_id: appId } }).catch(() => {});
        await DbAdapter.update(OAuthAccessToken, { revoked_at: now }, { where: { app_id: appId } }).catch(() => {});
        await DbAdapter.update(OAuthRefreshToken, { revoked_at: now }, { where: { app_id: appId } }).catch(() => {});
        await OAuthAuthCode.destroy({ where: { app_id: appId } }).catch(() => {});
        await UserAppAuthorization.destroy({ where: { app_id: appId } }).catch(() => {});
        await DeveloperAppAuditLog.destroy({ where: { app_id: appId } }).catch(() => {});
        await app.destroy();
        logOperation(req, 'delete_developer_app', 'developer_app', appId, {});
        return successResponse(res, null, '应用已删除');
    } catch (e) {
        console.error('[adminDeleteApp]', e);
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
          order: [['created_at', 'DESC']],
          limit: pageSize,
          offset,
          include: [{ model: User, as: 'actor', attributes: ['id', 'username', 'nickname'], required: false }]
        });
        const list = rows.map(row => {
            const json = row.toJSON ? row.toJSON() : row;
            let meta = null;
            try { meta = json.meta ? JSON.parse(json.meta) : null; } catch (_) { meta = null; }
            return {
                id: json.id,
                action: json.action,
                from_status: json.from_status,
                to_status: json.to_status,
                review_note: json.review_note,
                rate_limit_before: json.rate_limit_before,
                rate_limit_after: json.rate_limit_after,
                actor: json.actor || null,
                meta,
                created_at: json.created_at
            };
        });
        return paginateResponse(res, list, count, page, pageSize);
    } catch (e) {
        console.error('[adminListAuditLogs]', e);
        return errorResponse(res, '获取审核历史失败', 500);
    }
}

async function adminCallLogStats(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const appId = DbAdapter.getId(app);
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const total = await DbAdapter.count(OperationLog, { where: { action: 'developer_api_call', target_type: 'developer_app', target_id: appId } });
        const fails = await DbAdapter.count(OperationLog, { where: { action: 'developer_api_fail', target_type: 'developer_app' } });
        const last30d = await DbAdapter.count(OperationLog, { where: { action: 'developer_api_call', target_type: 'developer_app', target_id: appId, created_at: { [Op.gte]: since } } });
        return successResponse(res, { total, fails, last30d });
    } catch (e) {
        console.error('[adminCallLogStats]', e);
        return errorResponse(res, '获取调用统计失败', 500);
    }
}

async function adminListCallLogStatsDetail(req, res) {
    try {
        const app = await DbAdapter.findByPk(DeveloperApp, req.params.id);
        if (!app) return errorResponse(res, '应用不存在', 404);
        const appId = DbAdapter.getId(app);
        const days = clampInt(req.query.days, 1, 90, 14);
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
            const d = new Date(row.created_at);
            const day = d.toISOString().slice(0, 10);
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
        console.error('[adminListCallLogStatsDetail]', e);
        return errorResponse(res, '获取调用分布失败', 500);
    }
}

`;
s = s.replace("// -------- OAuth --------", newAdmin + "// -------- OAuth --------");

// 5) enhance adminListAppCalls to support filters
check("        const { count, rows } = await DbAdapter.findAndCountAll(OperationLog, {\n            where: { action: 'developer_api_call', target_type: 'developer_app', target_id: DbAdapter.getId(app) },\n            order: [['created_at', 'DESC']],\n            limit: pageSize,\n            offset\n        });");
const callsReplacement = `        const where = { action: 'developer_api_call', target_type: 'developer_app', target_id: DbAdapter.getId(app) };
        if (req.query.status) where['details'] = { [Op.like]: '%' + String(req.query.status).trim() + '%' };
        if (req.query.path) where['details'] = { ...(where['details'] || {}), [Op.like]: '%' + String(req.query.path).trim() + '%' };
        if (req.query.from || req.query.to) {
            where.created_at = {};
            if (req.query.from) where.created_at[Op.gte] = new Date(String(req.query.from));
            if (req.query.to) where.created_at[Op.lte] = new Date(String(req.query.to));
        }
        const { count, rows } = await DbAdapter.findAndCountAll(OperationLog, {
            where,
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset
        });`;
s = s.replace("        const { count, rows } = await DbAdapter.findAndCountAll(OperationLog, {\n            where: { action: 'developer_api_call', target_type: 'developer_app', target_id: DbAdapter.getId(app) },\n            order: [['created_at', 'DESC']],\n            limit: pageSize,\n            offset\n        });", callsReplacement);

// 6) append new functions to exports
check("    openReviewStudio\n};");
s = s.replace("    openReviewStudio\n};", "    openReviewStudio,\n    adminUpdateRateLimit,\n    adminRevokeAllTokens,\n    adminRegenerateSecret,\n    adminDeleteApp,\n    adminListAuditLogs,\n    adminCallLogStats,\n    adminListCallLogStatsDetail\n};");

fs.writeFileSync(filePath, s, "utf8");
console.log("patched developerController.js ->", s.length, "bytes");
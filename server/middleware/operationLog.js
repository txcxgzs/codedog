/**
 * 管理操作审计日志。
 *
 * 所有后台请求由 auditAdminRequest 自动记录；logOperation/logAction 保留给
 * 非后台路由及需要补充业务语义的调用方。
 */

const {
    OperationLog, User, Work, Comment, Post, Studio, StudioMember, StudioWork,
    Report, DeveloperApp, Announcement, Banner, IpBan, SystemConfig, SensitiveWord
} = require('../models');

const SECRET_KEY = /(password|passwd|pwd|token|secret|authorization|cookie|session|client_secret|private_key|captcha)/i;
const MAX_DEPTH = 8;
const MAX_STRING = 50000;
const MAX_ARRAY = 1000;

function sanitize(value, key = '', depth = 0, seen = new WeakSet()) {
    if (SECRET_KEY.test(key)) return value == null || value === '' ? value : '[REDACTED]';
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') {
        return value.length > MAX_STRING
            ? `${value.slice(0, MAX_STRING)}…[截断 ${value.length - MAX_STRING} 字符]`
            : value;
    }
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
    if (depth >= MAX_DEPTH) return '[超过最大记录深度]';
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '[循环引用]';
    seen.add(value);
    if (Array.isArray(value)) {
        const result = value.slice(0, MAX_ARRAY).map((item) => sanitize(item, '', depth + 1, seen));
        if (value.length > MAX_ARRAY) result.push(`[另有 ${value.length - MAX_ARRAY} 项]`);
        return result;
    }
    const source = typeof value.toJSON === 'function' ? value.toJSON() : value;
    const result = {};
    for (const [childKey, childValue] of Object.entries(source)) {
        result[childKey] = sanitize(childValue, childKey, depth + 1, seen);
    }
    return result;
}

function getIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null)
        || req.ip || req.socket?.remoteAddress || 'unknown';
}

async function logOperation(req, action, targetType = null, targetId = null, details = {}) {
    try {
        const safeDetails = sanitize(details || {});
        await OperationLog.create({
            user_id: req.user?.id || null,
            action,
            target_type: targetType,
            target_id: targetId !== null && targetId !== undefined && targetId !== '' && Number.isInteger(Number(targetId))
                ? Number(targetId) : null,
            details: JSON.stringify(safeDetails),
            ip_address: getIp(req),
            user_agent: req.headers['user-agent'] || 'unknown'
        });
    } catch (error) {
        console.error('记录操作日志错误:', error);
    }
}

function routeInfo(req) {
    const path = req.path || '';
    const segments = path.split('/').filter(Boolean);
    const resource = segments[0] || 'admin';
    const suffix = segments.slice(1).filter((part) => !/^\d+$/.test(part)).join('_');
    const verb = { GET: 'view', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[req.method] || req.method.toLowerCase();
    return {
        action: `admin_${verb}_${resource.replace(/-/g, '_')}${suffix ? `_${suffix.replace(/-/g, '_')}` : ''}`.slice(0, 100),
        targetType: resource.replace(/-/g, '_').replace(/s$/, ''),
        targetId: segments.find((part, index) => index > 0 && /^\d+$/.test(part)) || null
    };
}

function snapshotResolver(req) {
    const p = req.path;
    const member = p.match(/^\/studios\/(\d+)\/members\/(\d+)/);
    if (member) return { model: StudioMember, where: { studio_id: Number(member[1]), user_id: Number(member[2]) } };
    const maps = [
        [/^\/users\/(\d+)/, User], [/^\/works\/(\d+)/, Work],
        [/^\/comments\/(\d+)/, Comment], [/^\/posts\/(\d+)/, Post],
        [/^\/studios\/(\d+)/, Studio], [/^\/studio-works\/(\d+)/, StudioWork],
        [/^\/reports\/(\d+)/, Report], [/^\/developer-apps\/(\d+)/, DeveloperApp],
        [/^\/announcements\/(\d+)/, Announcement], [/^\/banners\/(\d+)/, Banner],
        [/^\/ip-bans\/(\d+)/, IpBan], [/^\/sensitive-words\/(\d+)/, SensitiveWord]
    ];
    for (const [pattern, model] of maps) {
        const match = p.match(pattern);
        if (match) return { model, where: { id: Number(match[1]) } };
    }
    const config = p.match(/^\/configs\/([^/]+)/);
    if (config) return { model: SystemConfig, where: { config_key: decodeURIComponent(config[1]) } };
    return null;
}

async function readSnapshot(req) {
    const resolver = snapshotResolver(req);
    if (!resolver) return null;
    try {
        const record = await resolver.model.findOne({ where: resolver.where });
        return record ? sanitize(record) : null;
    } catch (error) {
        return { snapshot_error: error.message };
    }
}

/** 全量后台审计：成功、失败、读取和修改均记录。 */
function auditAdminRequest() {
    return async (req, res, next) => {
        const startedAt = Date.now();
        const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        const before = isMutation ? await readSnapshot(req) : undefined;
        const originalJson = res.json.bind(res);
        let written = false;
        const record = (body) => {
            if (!written) {
                written = true;
                const info = routeInfo(req);
                const finish = async () => {
                    const after = isMutation ? await readSnapshot(req) : undefined;
                    const details = {
                        schema_version: 2,
                        operator: sanitize({
                            id: req.user?.id,
                            username: req.user?.username,
                            nickname: req.user?.nickname,
                            role: req.user?.role
                        }),
                        request: sanitize({
                            request_id: req.id || req.headers['x-request-id'] || null,
                            method: req.method,
                            path: req.originalUrl,
                            route: req.route?.path || null,
                            params: req.params || {},
                            query: req.query || {},
                            body: req.body || {}
                        }),
                        result: sanitize({
                            success: res.statusCode < 400 && (!body || body.code == null || body.code === 200),
                            http_status: res.statusCode,
                            business_code: body?.code ?? null,
                            message: body?.msg ?? body?.message ?? null,
                            response: body?.data ?? body ?? null
                        }),
                        change: isMutation ? { before, after } : null,
                        context: {
                            ip: getIp(req),
                            user_agent: req.headers['user-agent'] || 'unknown',
                            referer: req.headers.referer || null,
                            duration_ms: Date.now() - startedAt,
                            recorded_at: new Date().toISOString()
                        }
                    };
                    await logOperation(req, info.action, info.targetType, info.targetId, details);
                };
                finish().catch((error) => console.error('管理员审计日志写入失败:', error));
            }
        };

        res.json = (body) => {
            record(body);
            return originalJson(body);
        };

        // 兼容直接 res.send/res.end、文件下载等非 JSON 响应，确保没有审计盲区。
        res.once('finish', () => record(null));

        next();
    };
}

function logAction(action, getTargetType = null, getTargetId = null, getDetails = null) {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            Promise.resolve(logOperation(
                req,
                action,
                getTargetType ? getTargetType(req) : null,
                getTargetId ? getTargetId(req, data) : null,
                {
                    request: sanitize({ params: req.params, query: req.query, body: req.body }),
                    response: sanitize(data),
                    extra: getDetails ? getDetails(req, data) : {}
                }
            )).catch((error) => console.error('操作日志异步写入失败:', error));
            return originalJson(data);
        };
        next();
    };
}

module.exports = { logOperation, logAction, auditAdminRequest, sanitize };

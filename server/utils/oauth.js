/**
 * OAuth2 / Developer platform helpers
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ALL_SCOPES = {
    'profile:email:read': {
        name: '读取邮箱地址',
        description: '读取当前用户已验证的邮箱地址，属于敏感个人信息',
        risk: 'read'
    },
    'profile:read': {
        name: '读取基本资料',
        description: '读取昵称、头像、简介、等级、粉丝/关注/作品数（不含邮箱与密码）'
    },
    'works:read': {
        name: '读取作品',
        description: '读取用户已发布的作品列表与详情'
    },
    'comments:read': {
        name: '读取评论',
        description: '读取用户发表的评论列表'
    },
    'posts:read': {
        name: '读取帖子',
        description: '读取用户发表的帖子列表与详情'
    },
    'studios:read': {
        name: '读取工作室',
        description: '读取用户加入的工作室列表与详情、成员和作品'
    },
    'follows:read': {
        name: '读取关注关系',
        description: '读取用户的关注列表与粉丝列表'
    },
    'favorites:read': {
        name: '读取收藏与点赞',
        description: '读取用户收藏的作品/帖子列表以及点赞记录'
    },
    'likes:read': {
        name: '读取点赞记录',
        description: '读取当前用户点赞过的作品、帖子记录',
        risk: 'read'
    },
    'studios:review': {
        name: '审核工作室',
        description: '查看待审核工作室并通过/拒绝（需应用已授权且用户具备管理员身份）',
        risk: 'admin'
    },
    'notifications:read': {
        name: '读取通知',
        description: '读取用户的站内通知和未读状态',
        risk: 'read'
    },
    'studios:members:read': {
        name: '读取工作室成员',
        description: '读取用户已加入工作室的成员列表和成员角色',
        risk: 'read'
    },
    'works:stats:read': {
        name: '读取作品统计',
        description: '读取用户作品的浏览、点赞、收藏和评论统计',
        risk: 'read'
    },
    'community:activity:read': {
        name: '读取社区动态',
        description: '读取用户近期发布的作品、帖子和评论动态',
        risk: 'read'
    },
    'reports:read': {
        name: '读取举报',
        description: '读取后台举报记录（授权用户还需具备举报查看权限）',
        risk: 'admin'
    },
    'reports:write': {
        name: '处理举报',
        description: '变更举报状态并执行处理动作（授权用户还需具备对应后台权限）',
        risk: 'admin'
    },
    'comments:write': {
        name: '管理评论',
        description: '以用户身份发表评论，并删除用户自己的评论',
        risk: 'write'
    },
    'posts:write': {
        name: '管理帖子',
        description: '以用户身份发布、编辑和删除用户自己的帖子',
        risk: 'write'
    },
    'works:write': {
        name: '管理作品',
        description: '发布用户自己的编程猫作品，并编辑或删除自己的作品',
        risk: 'write'
    },
    'notifications:write': {
        name: '发送应用通知',
        description: '由应用向当前授权用户发送站内通知',
        risk: 'write'
    },
    'openid': {
        name: '读取应用内用户标识',
        description: '读取仅在当前应用内稳定、不同应用之间不可关联的用户标识',
        risk: 'read'
    },
    'users:public:read': {
        name: '读取公开用户资料',
        description: '读取社区用户主动公开的主页资料，不包含邮箱、账号绑定和隐私字段',
        risk: 'read'
    },
    'works:public:read': {
        name: '读取社区公开作品',
        description: '读取已发布的公开作品列表与详情',
        risk: 'read'
    },
    'posts:public:read': {
        name: '读取社区公开帖子',
        description: '读取已发布的公开帖子列表与详情',
        risk: 'read'
    },
    'studios:public:read': {
        name: '读取公开工作室',
        description: '读取公开且正常运行的工作室列表与详情',
        risk: 'read'
    },
    'search:read': {
        name: '搜索社区公开内容',
        description: '搜索公开用户、作品、帖子和工作室',
        risk: 'read'
    },
    'community:feed:read': {
        name: '读取社区内容流',
        description: '读取社区最新、热门和精选公开内容',
        risk: 'read'
    },
    'community:stats:read': {
        name: '读取社区公开统计',
        description: '读取公开用户、作品、帖子和工作室数量等聚合数据',
        risk: 'read'
    },
    'works:analytics:read': {
        name: '读取作品数据分析',
        description: '读取当前授权用户作品的浏览、点赞、收藏和评论聚合数据',
        risk: 'read'
    },
    'posts:analytics:read': {
        name: '读取帖子数据分析',
        description: '读取当前授权用户帖子的浏览、点赞、收藏和评论聚合数据',
        risk: 'read'
    },
    'account:analytics:read': {
        name: '读取账号创作分析',
        description: '读取当前授权用户的公开创作数量与互动聚合数据',
        risk: 'read'
    },
    'comments:received:read': {
        name: '读取收到的评论',
        description: '读取其他用户在当前授权用户作品和帖子下发表的有效评论',
        risk: 'read'
    },
    'studios:applications:read': {
        name: '读取工作室加入申请',
        description: '工作室管理成员读取待处理加入申请，只读且仍需校验实际角色',
        risk: 'read'
    },
    'studios:submissions:read': {
        name: '读取工作室作品投稿',
        description: '工作室管理成员读取作品投稿，只读且仍需校验实际角色',
        risk: 'read'
    },
    'studios:analytics:read': {
        name: '读取工作室数据分析',
        description: '读取当前授权用户有权管理的工作室聚合统计',
        risk: 'read'
    },
    'studios:logs:read': {
        name: '读取工作室操作记录',
        description: '读取当前授权用户有权管理的工作室相关操作日志',
        risk: 'read'
    },
    'developer:usage:read': {
        name: '读取应用调用统计',
        description: '读取当前应用自己的接口调用量、状态码和路径分布',
        risk: 'read'
    }
};

const DEFAULT_SCOPES = ['profile:read'];
const ACCESS_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

function randomToken(prefix = '', bytes = 32) {
    return `${prefix}${crypto.randomBytes(bytes).toString('hex')}`;
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function hashSecret(secret) {
    return bcrypt.hash(String(secret), 10);
}

async function verifySecret(secret, hash) {
    if (!secret || !hash) return false;
    try {
        return await bcrypt.compare(String(secret), String(hash));
    } catch (e) {
        return false;
    }
}

function parseScopeString(scopeInput) {
    if (!scopeInput) return [];
    if (Array.isArray(scopeInput)) {
        return [...new Set(scopeInput.map(s => String(s).trim()).filter(Boolean))];
    }
    return [...new Set(String(scopeInput).split(/[\s,]+/).map(s => s.trim()).filter(Boolean))];
}

function normalizeScopes(scopes) {
    const list = parseScopeString(scopes);
    return list.filter(s => Object.prototype.hasOwnProperty.call(ALL_SCOPES, s));
}

function intersectScopes(a, b) {
    const setB = new Set(normalizeScopes(b));
    return normalizeScopes(a).filter(s => setB.has(s));
}

function hasScope(grantedScopes, needed) {
    const set = new Set(normalizeScopes(grantedScopes));
    return set.has(needed);
}

function parseJsonField(value, fallback = []) {
    if (value == null || value === '') return fallback;
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return parsed == null ? fallback : parsed;
    } catch (e) {
        return fallback;
    }
}

function stringifyJsonField(value) {
    return JSON.stringify(value == null ? [] : value);
}

function isLocalhostUrl(urlObj) {
    const host = (urlObj.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function validateRedirectUri(uri, { allowHttpLocalhost = true } = {}) {
    if (!uri || typeof uri !== 'string') return { ok: false, msg: 'redirect_uri 无效' };
    let url;
    try {
        url = new URL(uri);
    } catch (e) {
        return { ok: false, msg: 'redirect_uri 格式错误' };
    }
    if (url.hash) return { ok: false, msg: 'redirect_uri 不能包含 hash' };
    if (url.protocol === 'https:') return { ok: true, uri: url.toString() };
    if (url.protocol === 'http:' && allowHttpLocalhost && isLocalhostUrl(url)) {
        return { ok: true, uri: url.toString() };
    }
    if (process.env.NODE_ENV !== 'production' && url.protocol === 'http:') {
        return { ok: true, uri: url.toString() };
    }
    return { ok: false, msg: 'redirect_uri 必须为 https（本地开发可用 http://localhost）' };
}

function normalizeRedirectUris(input) {
    let list = input;
    if (typeof input === 'string') {
        list = input.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(list)) list = [];
    const result = [];
    for (const item of list) {
        const v = validateRedirectUri(String(item).trim());
        if (!v.ok) return { ok: false, msg: v.msg, list: [] };
        if (!result.includes(v.uri)) result.push(v.uri);
    }
    if (result.length === 0) return { ok: false, msg: '至少填写一个回调 URL', list: [] };
    if (result.length > 10) return { ok: false, msg: '回调 URL 最多 10 个', list: [] };
    return { ok: true, list: result };
}

function matchRedirectUri(registered, candidate) {
    const list = parseJsonField(registered, []);
    const c = String(candidate || '');
    return list.includes(c);
}

function buildRedirectWithParams(baseUri, params) {
    const url = new URL(baseUri);
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    return url.toString();
}

function publicAppView(app, { includeSecret = false, plainSecret = null } = {}) {
    if (!app) return null;
    const data = {
        id: app.id,
        name: app.name,
        description: app.description,
        homepage_url: app.homepage_url,
        logo_url: app.logo_url,
        client_id: app.client_id,
        redirect_uris: parseJsonField(app.redirect_uris, []),
        scopes_requested: parseJsonField(app.scopes_requested, []),
        status: app.status,
        review_note: app.review_note,
        reviewed_at: app.reviewed_at,
        rate_limit_per_min: app.rate_limit_per_min || 60,
        created_at: app.created_at,
        updated_at: app.updated_at
    };
    if (includeSecret && plainSecret) {
        data.client_secret = plainSecret;
        data.client_secret_notice = '请立即保存 client_secret，关闭后无法再次查看明文';
    }
    return data;
}

function scopeCatalog() {
    return Object.entries(ALL_SCOPES).map(([key, meta]) => ({
        key,
        name: meta.name,
        description: meta.description,
        risk: meta.risk || 'read'
    }));
}

module.exports = {
    ALL_SCOPES,
    DEFAULT_SCOPES,
    ACCESS_TOKEN_TTL_MS,
    REFRESH_TOKEN_TTL_MS,
    AUTH_CODE_TTL_MS,
    randomToken,
    hashToken,
    hashSecret,
    verifySecret,
    parseScopeString,
    normalizeScopes,
    intersectScopes,
    hasScope,
    parseJsonField,
    stringifyJsonField,
    validateRedirectUri,
    normalizeRedirectUris,
    matchRedirectUri,
    buildRedirectWithParams,
    publicAppView,
    scopeCatalog
};

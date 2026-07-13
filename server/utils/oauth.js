/**
 * OAuth2 / Developer platform helpers
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ALL_SCOPES = {
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
        description: meta.description
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

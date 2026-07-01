require('dotenv').config();
const crypto = require('crypto');

const configuredJwtSecret = process.env.JWT_SECRET;
const configuredSessionSecret = process.env.SESSION_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 修复: 弱密钥黑名单不全,扩充常见占位/默认密钥
const INSECURE_SECRETS = new Set([
    'development-secret-key-do-not-use-in-production',
    'your-random-secret-key-change-in-production',
    'your-session-secret-key-at-least-32-chars',
    'please-change-this-to-a-random-string-at-least-64-characters',
    'change-me',
    'secret',
    'jwt-secret',
    'session-secret',
    'your-jwt-secret',
    'default-secret'
]);

/**
 * 校验 JWT 密钥是否安全:类型为字符串、长度 >= 32、且不在弱密钥黑名单中
 */
function isValidJwtSecret(secret) {
    return typeof secret === 'string'
        && secret.length >= 32
        && !INSECURE_SECRETS.has(secret);
}

/**
 * 修复: 新增校验 Session 密钥,与 JWT 校验逻辑保持一致,供 app.js 使用
 */
function isValidSessionSecret(secret) {
    return typeof secret === 'string'
        && secret.length >= 32
        && !INSECURE_SECRETS.has(secret);
}

function resolveJwtSecret() {
    if (isValidJwtSecret(configuredJwtSecret)) {
        return configuredJwtSecret;
    }

    const message = 'JWT_SECRET is missing, too short, or uses an insecure default. Set a random secret with at least 32 characters.';
    if (process.env.NODE_ENV === 'production') {
        console.error(message);
        process.exit(1);
    }

    console.warn(`${message} Generated an in-memory development secret for this process.`);
    return crypto.randomBytes(48).toString('hex');
}

/**
 * 解析 Session 密钥,供 app.js 使用(逻辑与 JWT 一致)
 */
function resolveSessionSecret() {
    if (isValidSessionSecret(configuredSessionSecret)) {
        return configuredSessionSecret;
    }

    const message = 'SESSION_SECRET is missing, too short, or uses an insecure default. Set a random secret with at least 32 characters.';
    if (process.env.NODE_ENV === 'production') {
        console.error(message);
        process.exit(1);
    }

    console.warn(`${message} Generated an in-memory development secret for this process.`);
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    JWT_SECRET: resolveJwtSecret(),
    JWT_EXPIRES_IN,
    JWT_ISSUER: 'codedog-community',
    JWT_AUDIENCE: 'codedog-frontend',
    isValidJwtSecret,
    isValidSessionSecret,
    resolveSessionSecret
};

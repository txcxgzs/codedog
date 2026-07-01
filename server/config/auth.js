require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const configuredJwtSecret = process.env.JWT_SECRET;
const configuredSessionSecret = process.env.SESSION_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 修复(Report4 #6): 密钥持久化目录与文件路径。
// 当 env 未提供有效密钥时,把生成的密钥写入文件,使 PM2 cluster 下所有 worker 共享同一份密钥,
// 避免每进程 crypto.randomBytes 生成不同密钥 → token 跨进程失效 → 无限重登录。
// ⚠️ 多机器/多容器(文件系统不共享)部署仍需通过环境变量显式设置相同密钥,首次生成会输出告警。
// 修复: 使用 __dirname 基准路径而非 process.cwd(),避免从不同工作目录启动读到不同密钥文件
const SECRET_DIR = path.join(__dirname, '../../.data');
const JWT_SECRET_FILE = path.join(SECRET_DIR, '.jwt_secret');
const SESSION_SECRET_FILE = path.join(SECRET_DIR, '.session_secret');

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

/**
 * 从持久化文件读取或生成密钥(Report4 #6 修复)。
 * env 未提供有效密钥时的兜底:优先读取已有文件 → 不存在则生成并写入。
 * 这样 PM2 cluster 下所有 worker 共享同一份密钥,token 跨进程有效。
 *
 * @param {string} filePath - 密钥文件路径
 * @param {number} byteLength - 生成密钥的随机字节数
 * @param {string} envName - 对应的环境变量名(用于告警)
 * @returns {string} 密钥(十六进制字符串,长度 >= 32)
 */
function getOrCreatePersistentSecret(filePath, byteLength, envName) {
    // 1. 文件已存在:读取并校验(防止文件被篡改为弱密钥)
    try {
        const existing = fs.readFileSync(filePath, 'utf8').trim();
        if (existing && existing.length >= 32 && !INSECURE_SECRETS.has(existing)) {
            return existing;
        }
        // 文件存在但内容无效:继续走生成逻辑(会覆盖)
    } catch (e) {
        // 文件不存在或读取失败:继续走生成逻辑
    }

    // 2. 文件不存在:生成新密钥并写入(仅首个启动的 worker 会真正生成,后续 worker 读到同一文件)
    const generated = crypto.randomBytes(byteLength).toString('hex');
    let persisted = false;
    try {
        fs.mkdirSync(SECRET_DIR, { recursive: true });
        // 0600 权限:仅 owner 可读写,防止其他用户读取密钥
        fs.writeFileSync(filePath, generated, { mode: 0o600 });
        persisted = true;
    } catch (writeErr) {
        // 写入失败(如只读文件系统):退回内存中的 generated,但多进程将不一致
        console.error(`⚠️ 无法持久化 ${envName} 到 ${filePath}: ${writeErr.message}。多进程/集群部署将出现密钥不一致!`);
    }

    if (persisted) {
        // 首次生成时大声告警,提示运维为多实例部署显式设置环境变量
        console.warn(
            `⚠️ ${envName} 未通过环境变量提供,已在 ${filePath} 生成新的持久化密钥。\n`
            + `   多实例部署(如 PM2 cluster 多机器、K8s 多 Pod)请务必通过环境变量 ${envName} 显式设置相同密钥,`
            + `并确保所有实例能访问同一份密钥文件或共享存储。`
        );
    }
    return generated;
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

    // 修复(Report4 #6): 非生产环境改用持久化文件密钥替代每进程随机密钥,
    // 保证 PM2 cluster 各 worker 共享同一密钥(原 crypto.randomBytes 会导致 token 跨进程失效)
    return getOrCreatePersistentSecret(JWT_SECRET_FILE, 48, 'JWT_SECRET');
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

    // 修复(Report4 #6): 非生产环境改用持久化文件密钥替代每进程随机密钥,
    // 保证 PM2 cluster 各 worker 共享同一密钥(原 crypto.randomBytes 会导致 session 跨进程失效)
    return getOrCreatePersistentSecret(SESSION_SECRET_FILE, 32, 'SESSION_SECRET');
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

/**
 * 安全日志工具：自动脱敏常见 PII/敏感字段
 *
 * 设计目标：
 * 1. 默认对敏感字段（password/token/api_key/secret/cookie/email）打码
 * 2. 大对象（用户/作品）只输出关键审计字段，丢弃全量数据
 * 3. 长字符串截断，防止日志爆炸
 * 4. 通过环境变量 SAFE_LOG=0 可关闭脱敏（开发时用）
 *
 * 不改变业务行为,仅替换 console.log 入口。
 */

const SAFE_LOG_ENABLED = process.env.SAFE_LOG !== '0';

// 字段级脱敏：值会被打码
const MASK_FIELDS = new Set([
    'password', 'passwd', 'pwd',
    'token', 'access_token', 'refresh_token', 'jwt', 'session',
    'api_key', 'apikey', 'secret', 'client_secret', 'private_key',
    'cookie', 'authorization', 'auth',
    'email',
    'phone', 'mobile',
    'codemao_password',
]);

// 字段级丢弃：键存在但值不输出（避免整对象/敏感 blob 进日志）
const DROP_FIELDS = new Set([
    'avatar', 'bio', 'description', 'preview', 'cover',
    'player_url', 'work_url', 'preview_url',
    'user_info', 'work', 'works', 'post', 'comment',
    'session_data', 'request_body', 'response_data',
]);

// 字段级保留：除上述外,这些字段输出（非白名单,仅审计常用）
const KEEP_FIELDS = new Set([
    'id', 'userId', 'username', 'nickname', 'role', 'status',
    'code', 'msg', 'message', 'action', 'type',
    'enabled', 'created_at', 'updated_at',
    'count', 'total', 'page', 'pageSize',
    'reviewResult', 'recommendation', 'riskLevel',
]);

const MAX_STRING_LENGTH = 200;

function maskValue(v) {
    if (v == null) return v;
    if (typeof v === 'string') {
        if (v.length <= 4) return '***';
        return v.slice(0, 2) + '***' + v.slice(-2);
    }
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    return '[masked]';
}

function truncateString(v) {
    if (typeof v !== 'string') return v;
    if (v.length <= MAX_STRING_LENGTH) return v;
    return v.slice(0, MAX_STRING_LENGTH) + `... [truncated ${v.length - MAX_STRING_LENGTH} chars]`;
}

/**
 * 脱敏一个对象/数组/基本类型
 * - 字符串截断(避免日志爆炸)
 * - 对象只保留 KEEP_FIELDS,其他字段丢弃
 * - 命中 MASK_FIELDS 的字段值打码
 */
function maskSensitive(data) {
    if (data == null) return data;
    if (typeof data === 'string') return truncateString(data);
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) {
        return data.map(item => maskSensitive(item));
    }
    const result = {};
    for (const [k, v] of Object.entries(data)) {
        const lowerKey = k.toLowerCase();
        if (MASK_FIELDS.has(lowerKey) || MASK_FIELDS.has(k)) {
            result[k] = maskValue(v);
        } else if (DROP_FIELDS.has(lowerKey) || DROP_FIELDS.has(k)) {
            // 整字段丢弃,不输出
            continue;
        } else if (KEEP_FIELDS.has(lowerKey) || KEEP_FIELDS.has(k)) {
            result[k] = typeof v === 'string' ? truncateString(v) : v;
        } else {
            // 未知字段,根据值类型决定
            if (typeof v === 'string') {
                result[k] = truncateString(v);
            } else if (typeof v === 'number' || typeof v === 'boolean' || v == null) {
                result[k] = v;
            } else {
                // 复杂对象/数组,递归脱敏
                result[k] = maskSensitive(v);
            }
        }
    }
    return result;
}

/**
 * 安全日志输出
 * @param {string} tag - 简短标签(如 'codemaoLogin' / 'initAdmin')
 * @param {any} data - 任意数据
 * @param {'log'|'warn'|'error'} level - console 级别
 */
function safeLog(tag, data, level = 'log') {
    if (SAFE_LOG_ENABLED) {
        const masked = maskSensitive(data);
        console[level](`[${tag}]`, masked);
    } else {
        // 开发模式:原始输出
        console[level](`[${tag}]`, data);
    }
}

module.exports = {
    safeLog,
    maskSensitive,
    SAFE_LOG_ENABLED,
};

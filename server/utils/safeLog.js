/**
 * 安全日志工具：自动脱敏常见 PII/敏感字段
 *
 * 设计目标：
 * 1. 默认对敏感字段（password/token/api_key/secret/cookie/email）打码
 * 2. 任何字段都不丢弃 — 即使是 description/avatar/bio 也只是截断到 80 字符保留可读性
 * 3. 长字符串截断，防止日志爆炸
 * 4. 通过环境变量 SAFE_LOG=0 可关闭脱敏（开发时用）
 * 5. 永不抛错 — safeLog 永远不应该导致业务请求失败
 *
 * 关键不变量：
 * - safeLog 内部 try/catch 包裹,即使内部出错也只打一行 fallback
 * - 不修改传入的 data (纯函数,递归返回新对象)
 * - 任何 typeof 异常值(函数/Symbol/Error 对象)都安全降级为 String()
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

// 字段级截断（保留前 80 字符，不脱敏）：用于资源 URL/描述等需要看内容但不应爆日志的字段
const TRUNCATE_ONLY_FIELDS = new Set([
    'description', 'bio', 'preview', 'cover', 'content',
    'player_url', 'work_url', 'preview_url', 'work_url',
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

// 智能打码字符串值:头/中/尾各保留 1~2 字符(可读性最大化,泄露最小化)
// - 短字符串(<=8)只保留首 1 字符,避免暴露比例过高
// - 中等字符串(9-32)头尾各 1,中间用 * 填充
// - 长字符串(>32)头尾各 2,中间用 * 填充(保留长度感)
// - email 特殊:保留用户名首 2 + @ + 域(fo***@gmail.com)
// 输出:首尾字符保留,中间用 1~2 个 * 表示
function maskValue(v, keyHint) {
    if (v == null) return v;
    if (typeof v === 'string') {
        // 短字符串:全部打码
        if (v.length <= 4) return '***';
        // email 特殊:保留用户名首 2 + @ + 域
        // 字段名含 email (如 user_email / contact_email) 都按 email 处理
        if (keyHint && keyHint.includes('email')) {
            const at = v.indexOf('@');
            const user = v.slice(0, at);
            const domain = v.slice(at);
            if (user.length <= 2) return `*${domain}`;
            return user.slice(0, 2) + '***' + domain;
        }
        // token/key/secret 等高熵值:头+中+尾三段式
        // 短(5-16):头 1 + ** + 尾 1
        // 中(17-32):头 2 + *** + 尾 1
        // 长(>32):头 2 + *** + 尾 2
        if (v.length <= 16) {
            return v.slice(0, 1) + '**' + v.slice(-1);
        }
        if (v.length <= 32) {
            return v.slice(0, 2) + '***' + v.slice(-1);
        }
        return v.slice(0, 2) + '***' + v.slice(-2);
    }
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    return '[masked]';
}

function truncateString(v, maxLen = MAX_STRING_LENGTH) {
    if (typeof v !== 'string') return v;
    if (v.length <= maxLen) return v;
    return v.slice(0, maxLen) + `... [truncated ${v.length - maxLen} chars]`;
}

/**
 * 脱敏一个对象/数组/基本类型
 * - 字符串截断(避免日志爆炸)
 * - 对象只保留 KEEP_FIELDS,其他字段丢弃
 * - 命中 MASK_FIELDS 的字段值打码
 */
function maskSensitive(data, _seen = new WeakSet()) {
    // 循环引用检测: 防止 self.self.self 无限递归
    if (data != null && typeof data === 'object') {
        if (_seen.has(data)) return '[Circular]';
        _seen.add(data);
    }
    // 类型防御: 处理 function/Symbol/Error/Map/Set 等 typeof === 'object' 但非普通对象的情况
    if (data == null) return data;
    if (typeof data === 'string') return truncateString(data);
    if (typeof data === 'number' || typeof data === 'boolean') return data;
    if (typeof data === 'function') return '[Function]';
    if (typeof data === 'symbol') return '[Symbol]';
    if (typeof data === 'bigint') return '[BigInt]';
    if (typeof data !== 'object') return String(data);
    // Date / RegExp / Error 等内置对象
    if (data instanceof Date) return data.toISOString();
    if (data instanceof RegExp) return data.toString();
    if (data instanceof Error) return data.message;
    if (data instanceof Map) return `[Map(${data.size})]`;
    if (data instanceof Set) return `[Set(${data.size})]`;
    // Buffer / TypedArray
    if (data instanceof Buffer) return `[Buffer(${data.length}B)]`;
    if (ArrayBuffer.isView(data)) return `[${data.constructor.name}(${data.length})]`;
    if (Array.isArray(data)) {
        return data.map(item => maskSensitive(item, _seen));
    }
    // 普通对象 - 浅拷贝 + 递归脱敏
    // Object.entries 对有原型链的对象也可能抛错(罕见), 保护一下
    let entries;
    try {
        entries = Object.entries(data);
    } catch (e) {
        return '[Object]';
    }
    const result = {};
    for (const [k, v] of entries) {
        const lowerKey = k.toLowerCase();
        // 匹配敏感字段:精确匹配 OR 字段名包含敏感关键词
        // (如 user_email / contact_email / new_password 都视为敏感)
        const isMask = MASK_FIELDS.has(lowerKey) || [...MASK_FIELDS].some(f => lowerKey.includes(f));
        const isTruncate = TRUNCATE_ONLY_FIELDS.has(lowerKey) || [...TRUNCATE_ONLY_FIELDS].some(f => lowerKey.includes(f));
        const isKeep = KEEP_FIELDS.has(lowerKey) || [...KEEP_FIELDS].some(f => lowerKey.includes(f));
        if (isMask) {
            result[k] = maskValue(v, lowerKey);
        } else if (isTruncate) {
            // 资源/描述类:截断到 80 字符,保留可读性
            result[k] = typeof v === 'string' ? truncateString(v, 80) : v;
        } else if (isKeep) {
            result[k] = typeof v === 'string' ? truncateString(v) : v;
        } else {
            // 未知字段,根据值类型决定
            if (typeof v === 'string') {
                result[k] = truncateString(v);
            } else if (typeof v === 'number' || typeof v === 'boolean' || v == null) {
                result[k] = v;
            } else if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') {
                result[k] = String(v);
            } else {
                // 复杂对象/数组,递归脱敏
                try {
                    result[k] = maskSensitive(v, _seen);
                } catch (e) {
                    result[k] = '[unserializable]';
                }
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
    // 最外层 try/catch: 保证 safeLog 永不抛错影响业务
    // 即使 maskSensitive 内部遇到未预期的对象结构,只输出 fallback
    try {
        if (SAFE_LOG_ENABLED) {
            const masked = maskSensitive(data);
            console[level](`[${tag}]`, masked);
        } else {
            // 开发模式:原始输出
            console[level](`[${tag}]`, data);
        }
    } catch (e) {
        // 兜底: 输出 tag + 错误信息,绝不传播
        try {
            console[level](`[${tag}] <safeLog-failed: ${e.message}>`);
        } catch (_) {
            // 极端情况 console 也失败,什么都不做
        }
    }
}

module.exports = {
    safeLog,
    maskSensitive,
    SAFE_LOG_ENABLED,
};

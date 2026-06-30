/**
 * 通用安全工具函数
 * 提供 HTML 转义、SQL LIKE 通配符转义、危险字符清理等基础能力。
 */

const { Op } = require('sequelize');

/**
 * 将 HTML 特殊字符转义为对应实体，用于防止 XSS。
 * 适用于后端需要生成或返回包含用户输入的 HTML/富文本片段前。
 *
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (text == null) return '';
    const str = String(text);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * 转义 SQL LIKE 通配符，避免用户输入中的 %、_ 改变 LIKE 语义。
 *
 * 使用反斜杠作为转义符：先转义反斜杠本身，再转义 % 和 _。
 * 注意必须先替换反斜杠，否则后续为 % / _ 添加的反斜杠会被二次转义。
 *
 * - MySQL 的 LIKE 默认以反斜杠为转义符，无需额外 ESCAPE 子句即可生效。
 * - SQLite / PostgreSQL 等没有默认转义符，需在查询中显式声明 ESCAPE
 *   才能完全中和通配符。推荐直接使用 likeContains() 构造查询条件，
 *   它会自动附带方言正确的 ESCAPE 子句。
 *
 * @param {string} value
 * @returns {string}
 */
function escapeLike(value) {
    if (value == null) return '';
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
}

// 仅允许安全的 SQL 标识符（列名），防止拼接注入
const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * 构造跨数据库方言安全的 LIKE “包含”匹配条件（自动附带 ESCAPE 子句）。
 *
 * 为什么需要它：escapeLike 只是把 % / _ / \\ 转义成「反斜杠 + 字符」，
 * 但只有在 LIKE 语句显式带上 ESCAPE '\\' 时这个转义才会生效。
 * MySQL 默认转义符恰好是反斜杠，所以不带 ESCAPE 也能跳过；但 SQLite/PG 没有
 * 默认转义符，不带 ESCAPE 时 % / _ 仍会被当作通配符。本函数统一补上 ESCAPE。
 *
 * 实现要点：
 * - 用 sequelize.escape() 生成方言正确且防注入的字符串字面量（值与转义符）。
 *   sequelize.escape('\\') 在 MySQL 返回 '\\\\'、在 SQLite 返回 '\\'，
 *   但两者表示的都是“单个反斜杠”转义符，因此跨方言一致。
 * - 列名由调用方硬编码传入（非用户输入），仍做标识符校验以防万一。
 * - 传入的列名须在查询中无歧义（本项目各调用点均满足）。
 *
 * @param {import('sequelize').Sequelize} sequelize - models 导出的 sequelize 实例
 * @param {string|string[]} columns - 参与匹配的列名
 * @param {string} keyword - 用户输入关键词
 * @returns {object|null} 形如 { [Op.or]: [literal, ...] } 的条件；keyword 为空时返回 null
 */
function likeContains(sequelize, columns, keyword) {
    if (keyword == null || String(keyword) === '') return null;
    if (!sequelize || typeof sequelize.escape !== 'function' || typeof sequelize.literal !== 'function') {
        throw new Error('likeContains 需要有效的 Sequelize 实例');
    }
    const cols = Array.isArray(columns) ? columns : [columns];
    if (cols.length === 0) return null;

    const pattern = sequelize.escape(`%${escapeLike(String(keyword))}%`);
    // 用 Sequelize 按方言转义单个反斜杠，得到 MySQL 的 '\\\\' 或 SQLite 的 '\\'
    const escapeChar = sequelize.escape('\\');

    const conditions = cols.map((col) => {
        if (!SAFE_SQL_IDENTIFIER.test(col)) {
            throw new Error(`likeContains 收到非法列名: ${col}`);
        }
        return sequelize.literal(`${col} LIKE ${pattern} ESCAPE ${escapeChar}`);
    });

    return { [Op.or]: conditions };
}

module.exports = {
    escapeHtml,
    escapeLike,
    likeContains
};

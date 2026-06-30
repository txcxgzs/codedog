/**
 * 通用安全工具函数
 * 提供 HTML 转义、SQL LIKE 通配符转义、危险字符清理等基础能力。
 */

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
 * - SQLite / PostgreSQL 等没有默认转义符，需在查询中显式声明 ESCAPE '\\\\'
 *   才能完全中和通配符；调用方在这些数据库上应配合 ESCAPE 子句使用。
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

module.exports = {
    escapeHtml,
    escapeLike
};

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
 * 转义 SQL LIKE 通配符，避免用户输入中的 %、_ 等改变 LIKE 语义。
 * 使用方括号转义语法 [%] [_]，兼容 MySQL 和 SQLite。
 *
 * @param {string} value
 * @returns {string}
 */
function escapeLike(value) {
    if (value == null) return '';
    const str = String(value);
    return str
        .replace(/%/g, '[%]')
        .replace(/_/g, '[_]')
        .replace(/\[/g, '[[]');
}

module.exports = {
    escapeHtml,
    escapeLike
};

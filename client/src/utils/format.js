/**
 * 统一时间格式化工具
 * 处理后端 MySQL/SQLite 的时间格式与时区问题
 * 兼容 'YYYY-MM-DD HH:mm:ss'（无时区，按本地解析）与 ISO 标准时间字符串
 */

/**
 * 格式化时间为指定格式
 * @param {Date|string|number} time 时间值
 * @param {string} fmt 格式模板，默认 'YYYY-MM-DD HH:mm'
 * @returns {string} 格式化后的时间字符串，解析失败返回空字符串
 */
export function formatTime(time, fmt = 'YYYY-MM-DD HH:mm') {
  if (time === null || time === undefined || time === '') return ''
  let date
  if (time instanceof Date) {
    date = time
  } else if (typeof time === 'string') {
    // 兼容 MySQL 'YYYY-MM-DD HH:mm:ss' 格式（无时区信息，按本地解析）
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time)) {
      date = new Date(time.replace(' ', 'T'))
    } else {
      date = new Date(time)
    }
  } else {
    date = new Date(time)
  }
  if (isNaN(date.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return fmt
    .replace('YYYY', date.getFullYear())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()))
}

/**
 * 相对时间格式化（刚刚、N 分钟前、N 小时前、N 天前，超过 30 天显示具体日期）
 * @param {Date|string|number} time 时间值
 * @returns {string} 相对时间字符串
 */
export function relativeTime(time) {
  if (time === null || time === undefined || time === '') return ''
  let date
  if (typeof time === 'string') {
    // 兼容 MySQL 时间格式
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time)) {
      date = new Date(time.replace(' ', 'T'))
    } else {
      date = new Date(time)
    }
  } else {
    date = new Date(time)
  }
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  // 修复: 未来时间直接显示格式化日期,避免负数 diff 被误判为"刚刚"
  if (diff < 0) return formatTime(time)
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前'
  return formatTime(time)
}

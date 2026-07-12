/**
 * 简单文件日志: 将所有日志写入 data/logs/app.log
 * 便于管理员在后台"实时日志"查看,同时保留 Docker 容器内所有输出
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../.data/logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB 自动轮转
const MAX_LOG_LINES = 2000; // 读取时最多返回行数

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function formatLine(level, tag, message) {
    const time = new Date().toISOString();
    return `[${time}] [${level}] [${tag}] ${message}`;
}

function writeLog(level, tag, message) {
    try {
        ensureLogDir();
        const line = formatLine(level, tag, message) + '\n';

        // 简单轮转: 超过 MAX_LOG_SIZE 则重命名为 .bak 并新建
        try {
            const stat = fs.statSync(LOG_FILE);
            if (stat.size > MAX_LOG_SIZE) {
                const bak = LOG_FILE + '.bak';
                fs.renameSync(LOG_FILE, bak);
            }
        } catch (e) {
            // 文件不存在,首次写入,忽略
        }

        fs.appendFileSync(LOG_FILE, line, { encoding: 'utf8' });
    } catch (e) {
        // 日志写入失败不应影响业务
        console.error('[logger] write failed:', e.message);
    }
}

function getRecentLogs(limit = 200) {
    try {
        ensureLogDir();
        if (!fs.existsSync(LOG_FILE)) {
            return [];
        }
        const content = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        return lines.slice(-limit);
    } catch (e) {
        return [];
    }
}

// 同时输出到文件 + 原始 console
function log(tag, message) {
    writeLog('INFO', tag, message);
    console.log(`[${tag}]`, message);
}

function warn(tag, message) {
    writeLog('WARN', tag, message);
    console.warn(`[${tag}]`, message);
}

function error(tag, message) {
    writeLog('ERROR', tag, message);
    console.error(`[${tag}]`, message);
}

module.exports = { log, warn, error, getRecentLogs, writeLog };
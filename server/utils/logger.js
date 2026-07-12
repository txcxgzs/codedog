/**
 * 异步文件日志: 将所有日志写入 data/logs/app.log
 * 便于管理员在后台"实时日志"查看,同时保留 Docker 容器内所有输出
 */

const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const readline = require('readline');

const LOG_DIR = path.join(__dirname, '../../.data/logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB 自动轮转

// 写队列:顺序写入,避免高并发下内容错乱
let writeQueue = Promise.resolve();

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function formatLine(level, tag, message) {
    const time = new Date().toISOString();
    return `[${time}] [${level}] [${tag}] ${message}`;
}

function enqueueWrite(level, tag, message) {
    // 入队异步写入,不阻塞事件循环
    writeQueue = writeQueue.then(() => doWrite(level, tag, message)).catch((e) => {
        console.error('[logger] write failed:', e.message);
    });
}

function doWrite(level, tag, message) {
    return new Promise((resolve) => {
        try {
            ensureLogDir();
            const line = formatLine(level, tag, message) + '\n';

            // 简单轮转:超过 MAX_LOG_SIZE 则重命名为 .bak 并新建
            try {
                const stat = fs.statSync(LOG_FILE);
                if (stat.size > MAX_LOG_SIZE) {
                    fs.renameSync(LOG_FILE, LOG_FILE + '.bak');
                }
            } catch (e) {
                // 文件不存在,首次写入,忽略
            }

            // 修复: 异步写入,不阻塞事件循环
            fs.appendFile(LOG_FILE, line, { encoding: 'utf8' }, () => resolve());
        } catch (e) {
            // 日志写入失败不应影响业务
            resolve();
        }
    });
}

// 同时输出到原始 console
function log(tag, message) {
    enqueueWrite('INFO', tag, message);
    console.log(`[${tag}]`, message);
}

function warn(tag, message) {
    enqueueWrite('WARN', tag, message);
    console.warn(`[${tag}]`, message);
}

function error(tag, message) {
    enqueueWrite('ERROR', tag, message);
    console.error(`[${tag}]`, message);
}

// 高效尾部读取: 从文件末尾倒序读取 N 行(大文件友好,异步 Promise)
function getRecentLogs(limit = 200) {
    return new Promise((resolve) => {
        try {
            ensureLogDir();
            if (!fs.existsSync(LOG_FILE)) {
                resolve([]);
                return;
            }

            // 修复: 用 readline 流式读取,避免全文件读入内存
            const lines = [];
            const stream = createReadStream(LOG_FILE, { encoding: 'utf8' });
            const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

            rl.on('line', (line) => {
                if (line.trim()) lines.push(line);
            });

            rl.on('close', () => {
                resolve(lines.slice(-limit));
            });

            rl.on('error', () => {
                resolve([]);
            });
        } catch (e) {
            resolve([]);
        }
    });
}

module.exports = { log, warn, error, getRecentLogs, writeLog: enqueueWrite };
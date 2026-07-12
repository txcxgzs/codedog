require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const { sequelize, testConnection } = require('./config/database');
const { isValidSessionSecret, resolveSessionSecret } = require('./config/auth');
const { User } = require('./models');
const DbAdapter = require('./utils/dbAdapter');

const userRoutes = require('./routes/userRoutes');
const workRoutes = require('./routes/workRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const studioRoutes = require('./routes/studioRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const followRoutes = require('./routes/followRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const geetestRoutes = require('./routes/geetestRoutes');
const hcaptchaRoutes = require('./routes/hcaptchaRoutes');
const dbMigrationRoutes = require('./routes/dbMigration');
const { hcaptchaGuard } = require('./middleware/hcaptcha');
const { createRateLimiter } = require('./middleware/rateLimit');
const { ipBanMiddleware } = require('./middleware/ipBan');
const { createSequelizeSessionStore } = require('./services/sessionStore');

const app = express();
app.disable('x-powered-by');

// 信任代理：默认关闭。仅当明确设置 TRUST_PROXY=true 且前端有可信反向代理(Nginx/Cloudflare)时开启，
// 否则 X-Forwarded-For 可被客户端伪造，导致限流、IP 白名单失效。
const trustProxyEnabled = process.env.TRUST_PROXY === 'true';
app.set('trust proxy', trustProxyEnabled ? 1 : false);

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !isProduction;

function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        // script-src 保持严格:未知 JS 一旦放行,XSS 直接成真
        "script-src 'self' https://static.geetest.com https://*.geetest.com https://hcaptcha.com https://*.hcaptcha.com 'sha256-woUEpn988/d1lffqaFZ+jz+X5Lq2Kh9MoieNyiJyuzY='",
        // style/img/font 放宽到 https: + data:,能加载任何 HTTPS 源,
        // 这三类就算被注入也只能改显示/显示图片,不会执行任意代码
        "style-src 'self' 'unsafe-inline' https:",
        "img-src 'self' data: https: http:",
        "font-src 'self' data: https:",
        "connect-src 'self' https://*.codemao.cn wss://*.codemao.cn https://*.geetest.com https://hcaptcha.com https://*.hcaptcha.com",
        "frame-src 'self' https://*.codemao.cn https://hcaptcha.com/",
        "form-action 'self'"
    ].join('; '));
}

// 修复: 删除本地 resolveSessionSecret,改用 auth.js 的持久化版本,确保 PM2 cluster 各 worker 共享同一密钥
// isValidSessionSecret 仍保留用于其他校验场景

async function ensureInitialSuperadmin() {
    // 启动时检查：如果数据库只有1个用户且不是超级管理员，自动提升
    // 与 userController.js 的 shouldPromoteInitialAdmin 配合，双重保险
    const userCount = await DbAdapter.count(User, {});
    if (userCount === 0) {
        console.log('No users exist. The first logged-in user will become superadmin automatically.');
        return;
    }

    if (userCount !== 1) return;

    const firstUser = await User.findOne({ order: [['id', 'ASC']] });
    if (!firstUser) return;

    if (firstUser.role !== 'superadmin') {
        await firstUser.update({ role: 'superadmin' });
        console.log(`Initial administrator auto-promoted: ${firstUser.nickname || firstUser.username || firstUser.id}`);
    }
}

// CORS 配置：默认不允许任意来源，只放行 CORS_ORIGIN 环境变量中配置的域名
// 多个 origin 可用逗号分隔；未配置时生产环境拒绝跨域，开发环境放行 localhost
const rawCorsOrigin = process.env.CORS_ORIGIN || '';
const allowedOrigins = rawCorsOrigin
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors((req, callback) => {
    const requestOrigin = req.header('Origin');
    let allow = false;

    if (!requestOrigin) {
        // 非浏览器同源请求(如 curl、服务器间调用)无需校验 Origin
        allow = true;
    } else if (allowedOrigins.length === 0) {
        // 未配置 CORS_ORIGIN：开发环境放行 localhost，生产环境拒绝
        allow = !isProduction && /^https?:\/\/localhost(:\d+)?$/.test(requestOrigin);
    } else {
        allow = allowedOrigins.some(o => o === requestOrigin);
    }

    callback(null, {
        origin: allow,
        credentials: true,
        optionsSuccessStatus: 204
    });
}));

app.use((req, res, next) => {
    setSecurityHeaders(res);
    next();
});

const loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: 'login',
    keyGenerator: req => `${req.ip}:${String(req.body?.username || '').toLowerCase()}`
});

const codemaoImportRateLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 20,
    keyPrefix: 'codemao-import'
});

const writeRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 120,
    keyPrefix: 'api-write',
    skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
});

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ code: 400, msg: 'Invalid JSON request body', data: null });
    }
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ code: 413, msg: 'Request body is too large', data: null });
    }
    if (err?.status && err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ code: err.status, msg: 'Invalid request body', data: null });
    }
    next(err);
});

app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    const normalizedQuery = { ...req.query };
    if (normalizedQuery.page !== undefined) {
        const page = parseInt(normalizedQuery.page, 10);
        normalizedQuery.page = String(Number.isFinite(page) && page > 0 ? page : 1);
    }
    if (normalizedQuery.pageSize !== undefined) {
        const pageSize = parseInt(normalizedQuery.pageSize, 10);
        const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;
        normalizedQuery.pageSize = String(Math.min(normalizedPageSize, 100));
    }
    // 修复: 添加 writable: true,避免后续中间件无法重新赋值 req.query
    Object.defineProperty(req, 'query', { value: normalizedQuery, writable: true, configurable: true, enumerable: true });
    next();
});

const sessionSecret = resolveSessionSecret();
const sessionStore = isProduction ? createSequelizeSessionStore(session, sequelize) : null;

const sessionOptions = {
    secret: sessionSecret,
    name: 'codedog.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax'
    }
};

if (sessionStore) sessionOptions.store = sessionStore;

app.use(session(sessionOptions));

// IP 封禁中间件: 置于限流之前,被封禁 IP 直接 403,不占用限流配额
app.use(ipBanMiddleware);

app.use('/api', writeRateLimiter);
app.use('/api/users/login', loginRateLimiter);
// 修复: 专项限流应挂在实际执行导入的路由 POST /api/works/import/:codemaoId 上
// 原先挂在 /api/works/codemao(GET 只读接口),无法限制实际触发编程猫 API + 审核 + 写库的导入操作
app.use('/api/works/import', codemaoImportRateLimiter);

app.use(hcaptchaGuard);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: setSecurityHeaders,
    dotfiles: 'deny',
    index: false
}));

app.use('/api/users', userRoutes);
app.use('/api/works', workRoutes);
app.use('/api/admin/db-migration', dbMigrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/studios', studioRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/geetest', geetestRoutes);
app.use('/api/hcaptcha', hcaptchaRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Service is running' });
});

const frontendPath = path.join(__dirname, '../client/dist');
const alternativePath = path.join(__dirname, 'public');

if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath, { setHeaders: setSecurityHeaders }));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        if (req.path.startsWith('/uploads/')) return res.status(404).end();
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else if (fs.existsSync(alternativePath)) {
    app.use(express.static(alternativePath, { setHeaders: setSecurityHeaders }));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        if (req.path.startsWith('/uploads/')) return res.status(404).end();
        res.sendFile(path.join(alternativePath, 'index.html'));
    });
}

app.use((req, res) => {
    res.status(404).json({ code: 404, msg: 'Not found', data: null });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err.message, err.stack);
    res.status(500).json({ code: 500, msg: 'Internal server error', data: null });
});

const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;

async function startServer() {
    try {
        await testConnection();

        // 生产环境禁用 alter:true：Sequelize 对 SQLite 的 alter 会创建临时表并
        // 复制数据，若中间崩溃会残留 *_backup 表，导致下次启动 id 唯一冲突。
        // 仅开发环境允许 alter:true。
        const syncOptions = isDevelopment ? { alter: true } : {};

        // 启动前兜底：清理 SQLite 中残留的 Sequelize 临时/备份表
        // 这些表通常是上一次 alter 中断遗留，会阻塞后续启动。
        if (isProduction && sequelize.options.dialect === 'sqlite') {
            try {
                const backupTables = await sequelize.query(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup'",
                    { type: sequelize.QueryTypes.SELECT }
                );
                for (const { name } of backupTables) {
                    await sequelize.query(`DROP TABLE IF EXISTS "${name}"`);
                    console.warn(`[启动清理] 已删除残留临时表: ${name}`);
                }
            } catch (cleanupError) {
                console.warn('[启动清理] 清理残留临时表失败:', cleanupError.message);
            }
        }

        // 迁移(必须在 sync 之前): 补齐老数据库缺失的列
        // 背景: 生产环境 sync 不带 alter,新增字段不会自动加到老数据库
        // 查询/写入时因找不到列而报错(SQLITE_ERROR: no such column)
        // 这里统一预检并 ALTER TABLE 补齐所有已知的新增列
        try {
            const dialect = sequelize.options.dialect;

            // 通用: 检查表是否存在且缺少某列,缺少则 ALTER TABLE ADD COLUMN
            async function ensureColumn(tableName, columnName, columnDef) {
                if (dialect === 'sqlite') {
                    const cols = await sequelize.query(`PRAGMA table_info(${tableName})`, { type: sequelize.QueryTypes.SELECT });
                    if (!cols.some(c => c.name === columnName)) {
                        console.log(`[迁移] 给 ${tableName} 表添加 ${columnName} 列...`);
                        // 修复: SQL 必须包含列名,否则 ALTER TABLE 报语法错误/列名丢失
                        await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef.sqlite}`);
                        return true;
                    }
                } else if (dialect === 'mysql') {
                    const cols = await sequelize.query(`SHOW COLUMNS FROM ${tableName} LIKE '${columnName}'`, { type: sequelize.QueryTypes.SELECT });
                    if (cols.length === 0) {
                        console.log(`[迁移] 给 ${tableName} 表添加 ${columnName} 列...`);
                        // 修复: SQL 必须包含列名
                        await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef.mysql}`);
                        return true
                    }
                }
                return false;
            }

            // User 表新增字段
            await ensureColumn('users', 'token_version', { sqlite: 'INTEGER DEFAULT 0', mysql: 'INT DEFAULT 0' });
            await ensureColumn('users', 'password_changed_at', { sqlite: 'DATETIME', mysql: 'DATETIME NULL' });

            // Post 表新增字段
            await ensureColumn('posts', 'hidden_reason', { sqlite: 'VARCHAR(50)', mysql: 'VARCHAR(50) NULL' });

            // Banner 表新增字段
            await ensureColumn('banners', 'source', { sqlite: 'VARCHAR(20)', mysql: 'VARCHAR(20) NULL' });

            // Studio 表新增字段 + 回填 owner_claim
            const addedOwnerClaim = await ensureColumn('studios', 'owner_claim', { sqlite: 'INTEGER', mysql: 'INT NULL' });
            if (addedOwnerClaim) {
                await sequelize.query("UPDATE studios SET owner_claim = owner_id WHERE status != 'banned' AND owner_claim IS NULL");
                console.log('[迁移] owner_claim 已回填 = owner_id');
            }

            // 修复: Report 表新增 merged_from_ids + status 加 merged
            await ensureColumn('reports', 'merged_from_ids', { sqlite: 'TEXT', mysql: 'TEXT NULL' });
            // MySQL: 修改 status ENUM 支持 merged
            if (dialect === 'mysql') {
                try {
                    const cols = await sequelize.query(`SHOW COLUMNS FROM reports LIKE 'status'`, { type: sequelize.QueryTypes.SELECT });
                    if (cols.length > 0 && !cols[0].Type.includes('merged')) {
                        console.log('[迁移] reports.status 加 merged...');
                        await sequelize.query("ALTER TABLE reports MODIFY COLUMN status ENUM('pending','processing','resolved','rejected','merged') NOT NULL DEFAULT 'pending'");
                    }
                } catch (e) {
                    console.warn('[迁移] reports.status ENUM 修改跳过:', e.message);
                }
            }

            console.log('[迁移] 列预检完成');
        } catch (migrationErr) {
            // 表可能尚未创建(首次部署),sync 后会自动带所有列,忽略
            console.warn('[迁移] 列预检跳过:', migrationErr.message);
        }

        await sequelize.sync(syncOptions);
        if (sessionStore) await sessionStore.sync();
        console.log('Database models synchronized.');

        try {
            const { Post } = require('./models');
            const [updated] = await Post.update({ status: 'published' }, { where: { status: 'active' } });
            if (updated > 0) console.log(`迁移完成：${updated} 条帖子状态从 active 更新为 published`);
        } catch (e) {
            console.warn('帖子状态迁移跳过:', e.message);
        }

        // 修复: 清理数据库中图片URL的反引号污染
        // 背景: 宝塔终端执行 curl/命令时,会自动给 https:// 开头的URL加反引号,
        // 导致存入数据库的 avatar/preview/cover 等字段值形如 `https://...`,
        // 前端渲染时 src 属性值带反引号,图片无法加载
        try {
            const { User, Work, Studio, Post, Banner } = require('./models');
            const cleanFields = [
                { model: User, field: 'avatar', label: 'users.avatar' },
                { model: Work, field: 'preview', label: 'works.preview' },
                { model: Work, field: 'work_url', label: 'works.work_url' },
                { model: Studio, field: 'cover', label: 'studios.cover' },
                { model: Studio, field: 'cover_url', label: 'studios.cover_url' },
                { model: Post, field: 'cover', label: 'posts.cover' },
                { model: Banner, field: 'image_url', label: 'banners.image_url' }
            ];
            for (const { model, field, label } of cleanFields) {
                // SQL REPLACE 清理反引号,只更新含反引号的行
                const result = await sequelize.query(
                    `UPDATE ${model.getTableName()} SET ${field} = REPLACE(${field}, '\`', '') WHERE ${field} LIKE '%\`%'`,
                    { type: sequelize.QueryTypes.UPDATE }
                );
                // SQLite 返回 [undefined, affectedCount], MySQL 返回 [affectedCount]
                const affected = Array.isArray(result) ? (result[1] || result[0] || 0) : 0;
                if (affected > 0) {
                    console.log(`[清理] ${label} 去除反引号: ${affected} 行`);
                }
            }
            console.log('[清理] 图片URL反引号清理完成');
        } catch (cleanErr) {
            console.warn('[清理] 图片URL反引号清理跳过:', cleanErr.message);
        }

        try {
            const { refreshRoleCache } = require('./config/permissions');
            const { RolePermission } = require('./models');
            await refreshRoleCache(RolePermission);
            console.log('Role permission cache refreshed.');
        } catch (e) {
            console.warn('Refresh role permission cache failed:', e.message);
        }

        await ensureInitialSuperadmin();

        // 修复: 保存 server 实例用于优雅停机和错误处理
        const server = app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);
            console.log(`API: http://localhost:${PORT}/api`);
            if (isProduction) {
                console.warn('[WARNING] 生产环境：限流、hCaptcha缓存、角色权限缓存均为进程内状态。多实例部署时请使用Redis等共享存储，否则限流可被绕过、权限不同步。');
            }
        });

        // 修复: 处理端口占用等启动错误
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`端口 ${PORT} 已被占用,请检查是否有其他进程正在运行`);
            } else {
                console.error('服务器启动失败:', err.message);
            }
            process.exit(1);
        });

        // 修复: 添加优雅停机处理,确保 PM2 reload/stop 时正在处理的请求完成
        function gracefulShutdown(signal) {
            console.log(`收到 ${signal},开始优雅停机...`);
            server.close(async () => {
                try {
                    await sequelize.close();
                } catch (e) { /* 忽略关闭错误 */ }
                process.exit(0);
            });
            // 5秒后强制退出
            setTimeout(() => process.exit(1), 5000).unref();
        }
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;

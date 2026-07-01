require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const { sequelize, testConnection } = require('./config/database');
const { isValidSessionSecret } = require('./config/auth');
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
const { createSequelizeSessionStore } = require('./services/sessionStore');

const app = express();
app.disable('x-powered-by');
// 修复 H2: trust proxy 不应硬编码 1,改为根据环境变量动态配置
// 反向代理(Nginx 等)部署时设 TRUST_PROXY=true 才信任 X-Forwarded-*,否则直连不信任防 IP 伪造
const trustProxy = process.env.TRUST_PROXY === 'true' ? 1 : false;
app.set('trust proxy', trustProxy);

const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];

if (isProduction && configuredOrigins.length === 0) {
    console.error('CORS_ORIGIN must be set explicitly in production.');
    process.exit(1);
}

const ALLOWED_ORIGINS = configuredOrigins.length > 0
    ? configuredOrigins
    : ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000'];

function normalizeOrigin(value) {
    if (!value) return null;
    try {
        const url = new URL(value);
        return `${url.protocol}//${url.host}`;
    } catch (e) {
        return null;
    }
}

function sameHostOrigins(host) {
    if (!host) return [];
    return [`http://${host}`, `https://${host}`];
}

function isAllowedOrigin(origin, host) {
    // 非浏览器请求通常没有 Origin，允许通过。
    if (!origin) return true;

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) return false;

    // 显式白名单优先。
    if (ALLOWED_ORIGINS.includes(normalizedOrigin)) return true;

    // 一键 Docker 部署常见访问方式是 http://服务器IP:3001。
    // 此时 .env 默认 CORS_ORIGIN=http://localhost:3001，但浏览器 Origin 会是服务器 IP。
    // 只允许“请求 Origin 与当前 Host 相同”的同站访问，避免误放开第三方来源。
    return sameHostOrigins(host).includes(normalizedOrigin);
}

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
        "script-src 'self' https://static.geetest.com https://*.geetest.com https://hcaptcha.com https://*.hcaptcha.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://*.codemao.cn",
        "font-src 'self' data:",
        "connect-src 'self' https://*.codemao.cn wss://*.codemao.cn https://*.geetest.com https://hcaptcha.com https://*.hcaptcha.com",
        // 修复 M4: 移除不必要的 https://www.google.com/recaptcha/(项目用的是 hCaptcha,不是 Google reCAPTCHA)
        "frame-src 'self' https://*.codemao.cn https://hcaptcha.com/",
        "form-action 'self'"
    ].join('; '));
}

// 修复 #21: 使用 config/auth.js 的 isValidSessionSecret 校验 session 密钥(与 JWT 一致,含弱密钥黑名单)
function resolveSessionSecret() {
    const configuredSecret = process.env.SESSION_SECRET;
    if (isValidSessionSecret(configuredSecret)) {
        return configuredSecret;
    }

    const message = 'SESSION_SECRET is missing or too short. Set a random secret with at least 32 characters.';
    if (isProduction) {
        console.error(message);
        process.exit(1);
    }

    console.warn(`${message} Generated an in-memory development secret for this process.`);
    return crypto.randomBytes(32).toString('hex');
}

app.use(cors((req, callback) => {
    const origin = req.headers.origin;
    callback(null, {
        origin: isAllowedOrigin(origin, req.headers.host),
        credentials: true,
        optionsSuccessStatus: 204
    });
}));

app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    if (!isSafeMethod && origin && !isAllowedOrigin(origin, req.headers.host)) {
        setSecurityHeaders(res);
        return res.status(403).json({
            code: 403,
            msg: 'Forbidden origin',
            data: null
        });
    }

    next();
});

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
        return res.status(400).json({
            code: 400,
            msg: 'Invalid JSON request body',
            data: null
        });
    }

    if (err?.type === 'entity.too.large') {
        return res.status(413).json({
            code: 413,
            msg: 'Request body is too large',
            data: null
        });
    }

    if (err?.status && err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({
            code: err.status,
            msg: 'Invalid request body',
            data: null
        });
    }

    next(err);
});

app.use((req, res, next) => {
    if (req.body === undefined) {
        req.body = {};
    }

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

    Object.defineProperty(req, 'query', {
        value: normalizedQuery,
        configurable: true,
        enumerable: true
    });

    next();
});

const sessionSecret = resolveSessionSecret();
const sessionStore = isProduction
    ? createSequelizeSessionStore(session, sequelize)
    : null;

const sessionOptions = {
    secret: sessionSecret,
    // 修复 M2: 自定义 cookie 名,避免默认 connect.sid 暴露技术栈(指纹识别)
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

if (sessionStore) {
    sessionOptions.store = sessionStore;
}

app.use(session(sessionOptions));

// 修复 M3: 调整限流顺序,所有 rateLimiter 必须在 hcaptchaGuard 之前,
// 否则 hCaptcha 校验阶段(可能查 DB / 访问外部服务)不受限流保护,易被滥用
// 顺序: writeRateLimiter -> loginRateLimiter -> codemaoImportRateLimiter -> hcaptchaGuard -> 路由
app.use('/api', writeRateLimiter);
app.use('/api/users/login', loginRateLimiter);
app.use('/api/works/codemao', codemaoImportRateLimiter);

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
    app.use(express.static(frontendPath, {
        setHeaders: setSecurityHeaders
    }));

    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        // 修复 L2: /uploads/ 找不到文件时不应返回 index.html,直接 404
        if (req.path.startsWith('/uploads/')) return res.status(404).end();
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else if (fs.existsSync(alternativePath)) {
    app.use(express.static(alternativePath, {
        setHeaders: setSecurityHeaders
    }));

    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        // 修复 L2: /uploads/ 找不到文件时不应返回 index.html,直接 404
        if (req.path.startsWith('/uploads/')) return res.status(404).end();
        res.sendFile(path.join(alternativePath, 'index.html'));
    });
}

app.use((req, res) => {
    res.status(404).json({
        code: 404,
        msg: 'Not found',
        data: null
    });
});

app.use((err, req, res, next) => {
    // 修复 M14: 错误日志不再打印整个 err 对象(可能含敏感字段),只打印 message + stack
    console.error('Server error:', err.message, err.stack);
    res.status(500).json({
        code: 500,
        msg: 'Internal server error',
        data: null
    });
});

const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;

async function startServer() {
    try {
        await testConnection();
        await sequelize.sync({ alter: true });
        if (sessionStore) {
            await sessionStore.sync();
        }
        console.log('Database models synchronized.');

        // 迁移旧数据：将 Post.status='active' 统一改为 'published'
        try {
            const { Post } = require('./models');
            const [updated] = await Post.update(
                { status: 'published' },
                { where: { status: 'active' } }
            );
            if (updated > 0) {
                console.log(`迁移完成：${updated} 条帖子状态从 active 更新为 published`);
            }
        } catch (e) {
            console.warn('帖子状态迁移跳过:', e.message);
        }

        // 启动时刷新角色权限缓存，避免热更新后 getRoleSync 永远走默认值
        try {
            const { refreshRoleCache } = require('./config/permissions');
            const { RolePermission } = require('./models');
            await refreshRoleCache(RolePermission);
            console.log('Role permission cache refreshed.');
        } catch (e) {
            console.warn('Refresh role permission cache failed:', e.message);
        }

        const userCount = await DbAdapter.count(User, {});
        if (userCount === 0) {
            console.log('No users exist. Configure INITIAL_ADMIN_CODEMAO_ID or INITIAL_ADMIN_BOOTSTRAP_TOKEN to bootstrap a superadmin.');
        }

        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);
            console.log(`API: http://localhost:${PORT}/api`);
            if (isProduction) {
                console.warn('[WARNING] 生产环境：限流、hCaptcha缓存、角色权限缓存均为进程内状态。多实例部署时请使用Redis等共享存储，否则限流可被绕过、权限不同步。');
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 修复 M7: uncaughtException 是严重错误,进程状态不可预知,应退出由进程管理器(如 PM2)重启
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;

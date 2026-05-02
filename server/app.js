/**
 * 应用入口文件
 * 创建Express服务器，配置中间件和路由
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { sequelize, testConnection } = require('./config/database');
const { User, Work, Announcement, Banner, Statistics, Studio, StudioMember, Comment, Post, Favorite, Report, IpBan, Notification } = require('./models');
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
const { hcaptchaGuard } = require('./middleware/hcaptcha');

const app = express();

// CORS配置：生产环境应该设置具体的域名
const ALLOWED_ORIGINS = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: function(origin, callback) {
        // 允许没有origin的请求（如移动应用或curl请求）
        if (!origin) return callback(null, true);
        
        // 开发环境允许所有来源
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        
        // 生产环境检查是否在白名单中
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('不允许的CORS来源'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session配置
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-at-least-32-chars',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 60 * 1000, // 30分钟
        httpOnly: true,
        secure: isProduction, // 生产环境HTTPS时启用
        sameSite: isProduction ? 'strict' : 'lax'
    }
}));

app.use('/uploads', express.static('uploads'));

app.use('/api/users', userRoutes);
app.use('/api/works', workRoutes);
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
    res.json({ status: 'ok', message: '服务运行正常' });
});

const path = require('path');
const frontendPath = path.join(__dirname, '../client/dist');
if (require('fs').existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else {
    // 也可以尝试 server/public
    const alternativePath = path.join(__dirname, 'public');
    if (require('fs').existsSync(alternativePath)) {
        app.use(express.static(alternativePath));
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api')) return next();
            res.sendFile(path.join(alternativePath, 'index.html'));
        });
    }
}

app.use((req, res) => {
    res.status(404).json({
        code: 404,
        msg: '接口不存在',
        data: null
    });
});

app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        code: 500,
        msg: '服务器内部错误',
        data: null
    });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await testConnection();
        await sequelize.sync({ alter: false });
        console.log('✅ 数据库模型同步完成');
        
        // 不再默认创建管理员账号
        // 第一个使用编程猫登录的用户将自动成为管理员
        const userCount = await DbAdapter.count(User, {});
        if (userCount === 0) {
            console.log('📌 系统首次启动，第一个使用编程猫登录的用户将自动成为管理员');
        }
        
        app.listen(PORT, () => {
            console.log(`🚀 服务器启动成功，端口: ${PORT}`);
            console.log(`📍 API地址: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('❌ 启动失败:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const { errorResponse } = require('../middleware/response');
const { createRateLimiter } = require('../middleware/rateLimit');

// 头像 MIME 类型到扩展名的映射
// 修复: 原 multer dest 选项生成无扩展名文件，某些静态服务/浏览器无法正确识别图片类型。
// 改用 diskStorage 根据 mimetype 添加正确扩展名；不支持的格式在 filename 阶段直接拒绝。
// (Report 2 #22) 暂不支持 GIF 头像（无动画策略，直接拒绝更安全）
const avatarExtMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

const allowedAvatarTypes = new Set(Object.keys(avatarExtMap));

// 登录限流（按 IP+username 限速，防御暴力登录）
const loginRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: 'login-user',
    keyGenerator: req => `${req.ip}:${String(req.body?.username || '').trim().toLowerCase()}`
});

function hasAllowedImageSignature(filePath, mimetype) {
    const bytes = fs.readFileSync(filePath);

    if (mimetype === 'image/jpeg') {
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }

    if (mimetype === 'image/png') {
        return bytes.length >= 8
            && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
            && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    }

    if (mimetype === 'image/webp') {
        return bytes.length >= 12
            && bytes.slice(0, 4).toString('ascii') === 'RIFF'
            && bytes.slice(8, 12).toString('ascii') === 'WEBP';
    }

    // GIF 文件签名: 前 6 字节为 'GIF87a' 或 'GIF89a'
    if (mimetype === 'image/gif') {
        if (bytes.length < 6) return false;
        const sig = bytes.slice(0, 6).toString('ascii');
        return sig === 'GIF87a' || sig === 'GIF89a';
    }

    return false;
}

async function validateAvatarUpload(req, res, next) {
    if (!req.file) {
        return next();
    }

    try {
        if (!allowedAvatarTypes.has(req.file.mimetype) || !hasAllowedImageSignature(req.file.path, req.file.mimetype)) {
            fs.unlink(req.file.path, () => {});
            return errorResponse(res, '仅支持 JPG、PNG、WebP 格式头像，暂不支持 GIF 头像', 400);
        }

        // 魔数校验通过后，使用 sharp 重新编码图片：
        // - 裁剪为 512x512 居中封面，统一尺寸
        // - 重新编码为 JPEG（mozjpeg 优化），剥离元数据与潜在恶意载荷
        // - 重编码失败时降级保留原图（不阻断流程），仅记录日志
        try {
            const filePath = req.file.path;
            const processedBuffer = await sharp(filePath)
                .resize(512, 512, { fit: 'cover', position: 'center' })
                .jpeg({ quality: 85, mozjpeg: true })
                .toBuffer();
            const newPath = filePath.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '.jpg');
            fs.writeFileSync(newPath, processedBuffer);
            if (newPath !== filePath) {
                fs.unlinkSync(filePath);
                req.file.path = newPath;
                req.file.filename = req.file.filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '.jpg');
            }
        } catch (err) {
            console.error('[Avatar] sharp 重编码失败，保留原图:', err.message);
        }

        next();
    } catch (error) {
        fs.unlink(req.file.path, () => {});
        return errorResponse(res, 'Avatar validation failed.', 400);
    }
}

const uploadDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 使用 diskStorage 替代 dest，根据 mimetype 添加正确的文件扩展名。
// 修复前: multer dest 生成的文件无扩展名，某些静态服务/浏览器无法正确识别图片类型。
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = avatarExtMap[file.mimetype];
        if (!ext) {
            // 不支持的图片格式直接拒绝（与 fileFilter 双重保险）
            return cb(new Error('不支持的图片格式'));
        }
        cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024,
        files: 1,
        fields: 12
    },
    fileFilter: (req, file, cb) => {
        if (allowedAvatarTypes.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('仅支持 JPG、PNG、WebP 格式头像，暂不支持 GIF 头像'));
        }
    }
});

function avatarUpload(req, res, next) {
    upload.single('avatar')(req, res, error => {
        if (!error) {
            return next();
        }

        const message = error instanceof multer.MulterError
            ? 'Invalid avatar upload.'
            : error.message || 'Invalid avatar upload.';
        return errorResponse(res, message, 400);
    });
}

router.post('/login', loginRateLimit, userController.login);
router.get('/me', authMiddleware, userController.getCurrentUser);
router.put('/profile', authMiddleware, avatarUpload, validateAvatarUpload, userController.updateProfile);
router.get('/:codemaoId', userController.getUserById);

module.exports = router;

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const { errorResponse } = require('../middleware/response');
const { createRateLimiter } = require('../middleware/rateLimit');

const allowedAvatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

    return false;
}

function validateAvatarUpload(req, res, next) {
    if (!req.file) {
        return next();
    }

    try {
        if (!allowedAvatarTypes.has(req.file.mimetype) || !hasAllowedImageSignature(req.file.path, req.file.mimetype)) {
            fs.unlink(req.file.path, () => {});
            return errorResponse(res, 'Only real JPG, PNG, or WebP images are allowed.', 400);
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

const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: 2 * 1024 * 1024,
        files: 1,
        fields: 12
    },
    fileFilter: (req, file, cb) => {
        if (allowedAvatarTypes.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG, or WebP images are allowed.'));
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

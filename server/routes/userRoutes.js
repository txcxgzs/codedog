/**
 * 用户路由
 * 仅支持编程猫账号登录
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');
const multer = require('multer');

const upload = multer({
    dest: 'uploads/avatars/',
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片'));
        }
    }
});

// 用户登录（仅支持编程猫账号）
router.post('/login', userController.login);

// 获取当前用户信息（需要登录）
router.get('/me', authMiddleware, userController.getCurrentUser);

// 更新用户资料（需要登录，支持头像上传）
router.put('/profile', authMiddleware, upload.single('avatar'), userController.updateProfile);

// 通过本地ID获取用户（内部使用）
router.get('/local/:id', userController.getUserByLocalId);

// 获取用户公开信息（使用编程猫用户ID）
router.get('/:codemaoId', userController.getUserById);

module.exports = router;

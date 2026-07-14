const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');
const { uploadToImageHost } = require('../services/imageHost');
const { successResponse, errorResponse } = require('../middleware/response');

const router = express.Router();
const tempDir = path.join(__dirname, '../uploads/image-temp');
fs.mkdirSync(tempDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: tempDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname || '')}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype))
});

router.post('/image', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) return errorResponse(res, '请选择 JPG、PNG、WebP 或 GIF 图片', 400);
  try {
    const url = await uploadToImageHost(req.file);
    return successResponse(res, { url }, '图片上传成功');
  } catch (error) {
    console.error('uploadImage', error);
    return errorResponse(res, '图片上传到图床失败，请稍后重试', 502);
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
});

module.exports = router;

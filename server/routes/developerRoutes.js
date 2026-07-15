/**
 * Developer portal routes (JWT required)
 */
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const developerController = require('../controllers/developerController');
const { authMiddleware } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');

router.use(authMiddleware);
const appIconDir = path.join(__dirname, '../uploads/app-icons');
fs.mkdirSync(appIconDir, { recursive: true });
const appIconUpload = multer({ storage: multer.diskStorage({ destination: appIconDir, filename: (req, file, cb) => { const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype]; cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext || ''}`) } }), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });

router.get('/docs/scopes', developerController.getScopeDocs);
router.get('/apps', developerController.listMyApps);
router.post('/apps', geetestVerify('developer_app'), developerController.createApp);
router.get('/apps/:id', developerController.getMyApp);
router.get('/apps/:id/calls', developerController.listMyAppCalls);
router.patch('/apps/:id', developerController.updateApp);
router.put('/apps/:id', developerController.updateApp);
router.post('/apps/:id/logo', appIconUpload.single('logo'), developerController.uploadAppLogo);
router.post('/apps/:id/rotate-secret', developerController.rotateSecret);

// User authorized third-party apps
router.get('/authorizations', developerController.listMyAuthorizations);
router.delete('/authorizations/:id', developerController.revokeMyAuthorization);
router.post('/authorizations/:id/revoke', developerController.revokeMyAuthorization);

module.exports = router;

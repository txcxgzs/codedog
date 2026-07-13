/**
 * Developer portal routes (JWT required)
 */
const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/docs/scopes', developerController.getScopeDocs);
router.get('/apps', developerController.listMyApps);
router.post('/apps', developerController.createApp);
router.get('/apps/:id', developerController.getMyApp);
router.patch('/apps/:id', developerController.updateApp);
router.put('/apps/:id', developerController.updateApp);
router.post('/apps/:id/rotate-secret', developerController.rotateSecret);

// User authorized third-party apps
router.get('/authorizations', developerController.listMyAuthorizations);
router.delete('/authorizations/:id', developerController.revokeMyAuthorization);
router.post('/authorizations/:id/revoke', developerController.revokeMyAuthorization);

module.exports = router;

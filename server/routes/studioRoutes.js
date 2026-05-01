const express = require('express');
const router = express.Router();
const studioController = require('../controllers/studioController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');

router.get('/', studioController.getStudios);
router.get('/my/list', authMiddleware, studioController.getMyStudios);
router.get('/detail/:id', optionalAuth, studioController.getStudioDetail);
router.get('/detail/:id/works', studioController.getStudioWorks);

router.post('/', authMiddleware, geetestVerify('create_studio'), studioController.createStudio);
router.post('/:id/join', authMiddleware, geetestVerify('join_studio'), studioController.joinStudio);
router.post('/:id/leave', authMiddleware, studioController.leaveStudio);
router.put('/:id', authMiddleware, studioController.updateStudio);
router.delete('/:id', authMiddleware, studioController.deleteStudio);

router.get('/:id/pending-members', authMiddleware, studioController.getPendingMembers);
router.post('/:id/members/:memberId/review', authMiddleware, geetestVerify('review_member'), studioController.reviewMember);
router.put('/:id/members/:memberId/role', authMiddleware, studioController.setMemberRole);
router.delete('/:id/members/:memberId', authMiddleware, studioController.kickMember);

router.post('/:id/works', authMiddleware, geetestVerify('submit_work'), studioController.submitWork);
router.get('/:id/pending-works', authMiddleware, studioController.getPendingWorks);
router.post('/:id/works/:workId/review', authMiddleware, studioController.reviewWork);
router.delete('/:id/works/:workId', authMiddleware, studioController.removeWork);
router.put('/:id/works/:workId/status', authMiddleware, studioController.toggleWorkStatus);

router.put('/:id/vice-owner', authMiddleware, studioController.setViceOwner);
router.delete('/:id/dissolve', authMiddleware, studioController.dissolveStudio);

module.exports = router;

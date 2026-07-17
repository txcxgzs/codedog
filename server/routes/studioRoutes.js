const express = require('express');
const router = express.Router();
const studioController = require('../controllers/studioController');
const managementController = require('../controllers/studioManagementController');
const forumController = require('../controllers/studioForumController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { geetestVerify } = require('../middleware/geetest');

router.get('/', studioController.getStudios);
router.get('/my/list', authMiddleware, studioController.getMyStudios);
router.get('/forum/all', optionalAuth, forumController.listAllPosts);
router.get('/:id', optionalAuth, studioController.getStudioDetail);
router.get('/:id/works', optionalAuth, studioController.getStudioWorks);
router.get('/:id/announcements', optionalAuth, managementController.listAnnouncements);
router.get('/:id/forum', optionalAuth, forumController.listPosts);
router.get('/:id/forum/:postId', optionalAuth, forumController.getPost);

router.post('/', authMiddleware, geetestVerify('create_studio'), studioController.createStudio);
router.post('/:id/join', authMiddleware, geetestVerify('join_studio'), studioController.joinStudio);
router.post('/:id/leave', authMiddleware, geetestVerify('studio_management'), studioController.leaveStudio);
router.put('/:id', authMiddleware, geetestVerify('studio_management'), studioController.updateStudio);
router.delete('/:id', authMiddleware, geetestVerify('studio_management'), studioController.deleteStudio);

router.get('/:id/pending-members', authMiddleware, studioController.getPendingMembers);
router.post('/:id/members/:memberId/review', authMiddleware, geetestVerify('review_member'), studioController.reviewMember);
router.put('/:id/members/:memberId/role', authMiddleware, geetestVerify('studio_management'), studioController.setMemberRole);
router.put('/:id/members/:memberId/permissions', authMiddleware, geetestVerify('studio_management'), managementController.setMemberPermissions);
router.delete('/:id/members/:memberId', authMiddleware, geetestVerify('studio_management'), studioController.kickMember);

router.post('/:id/works', authMiddleware, geetestVerify('submit_work'), studioController.submitWork);
router.get('/:id/pending-works', authMiddleware, studioController.getPendingWorks);
router.post('/:id/works/:workId/review', authMiddleware, geetestVerify('studio_management'), studioController.reviewWork);
router.delete('/:id/works/:workId', authMiddleware, geetestVerify('studio_management'), studioController.removeWork);
router.put('/:id/works/:workId/status', authMiddleware, geetestVerify('studio_management'), studioController.toggleWorkStatus);
router.put('/:id/works/:workId/display', authMiddleware, geetestVerify('studio_management'), managementController.updateWorkDisplay);

router.put('/:id/vice-owner', authMiddleware, geetestVerify('studio_management'), studioController.setViceOwner);
router.post('/:id/transfer', authMiddleware, geetestVerify('studio_management'), managementController.transferOwnership);
router.delete('/:id/dissolve', authMiddleware, geetestVerify('studio_management'), studioController.dissolveStudio);

router.get('/:id/capabilities', authMiddleware, managementController.getCapabilities);
router.get('/:id/invites', authMiddleware, managementController.listInvites);
router.post('/:id/invites', authMiddleware, geetestVerify('studio_management'), managementController.createInvite);
router.delete('/:id/invites/:inviteId', authMiddleware, geetestVerify('studio_management'), managementController.revokeInvite);
router.post('/invites/accept', authMiddleware, geetestVerify('studio_management'), managementController.acceptInvite);
router.get('/:id/logs', authMiddleware, managementController.listLogs);
router.post('/:id/announcements', authMiddleware, geetestVerify('studio_management'), managementController.createAnnouncement);
router.put('/:id/settings', authMiddleware, geetestVerify('studio_management'), managementController.updateSettings);
router.get('/:id/analytics', authMiddleware, managementController.getAnalytics);
router.get('/:id/blacklist', authMiddleware, managementController.listBlacklist);
router.post('/:id/blacklist', authMiddleware, geetestVerify('studio_management'), managementController.addBlacklist);
router.delete('/:id/blacklist/:blacklistId', authMiddleware, geetestVerify('studio_management'), managementController.removeBlacklist);
router.post('/:id/forum', authMiddleware, geetestVerify('studio_management'), forumController.createPost);
router.post('/:id/forum/:postId/replies', authMiddleware, geetestVerify('studio_management'), forumController.createReply);
router.put('/:id/forum/:postId/state', authMiddleware, geetestVerify('studio_management'), forumController.updatePostState);
router.delete('/:id/forum/:postId', authMiddleware, geetestVerify('studio_management'), forumController.deletePost);
router.delete('/:id/forum/:postId/replies/:replyId', authMiddleware, geetestVerify('studio_management'), forumController.deleteReply);

module.exports = router;

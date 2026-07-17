const { Op } = require('sequelize');
const DbAdapter = require('../utils/dbAdapter');
const { Studio, StudioMember, StudioForumPost, StudioForumReply, User, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const aiReview = require('../services/aiReview');
const { effectivePermissions, logOperation } = require('./studioManagementController');

const authorFields = ['id', 'codemao_user_id', 'username', 'nickname', 'avatar'];
const currentUserId = req => DbAdapter.getId(req.user);

async function activeStudio(id) {
    return DbAdapter.findOne(Studio, { where: { id, status: 'active' } });
}
async function membership(studioId, userId) {
    if (!userId) return null;
    return DbAdapter.findOne(StudioMember, { where: { studio_id: studioId, user_id: userId, status: 'active' } });
}
async function requireMember(req, res) {
    const studio = await activeStudio(req.params.id);
    if (!studio) { errorResponse(res, '工作室不存在', 404); return null; }
    const member = await membership(studio.id, currentUserId(req));
    if (!member) { errorResponse(res, '只有本工作室成员可以参与论坛', 403); return null; }
    return { studio, member };
}
async function reviewContent(text) {
    const result = await aiReview.fallbackReview(text);
    return result.recommendation === 'pass' ? null : (result.reason || '内容未通过审核');
}

async function listPosts(req, res) {
    try {
        const studio = await activeStudio(req.params.id);
        if (!studio) return errorResponse(res, '工作室不存在', 404);
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.max(1, Math.min(50, Number(req.query.pageSize) || 20));
        const result = await DbAdapter.findAndCountAll(StudioForumPost, {
            where: { studio_id: studio.id, status: 'active' },
            include: [{ model: User, as: 'author', attributes: authorFields }],
            order: [['is_pinned', 'DESC'], [sequelize.literal('COALESCE(last_reply_at, StudioForumPost.created_at)'), 'DESC']],
            limit: pageSize, offset: (page - 1) * pageSize, distinct: true
        });
        return successResponse(res, { list: result.rows, total: result.count, page, pageSize });
    } catch (error) { console.error('获取工作室论坛失败:', error); return errorResponse(res, '获取工作室论坛失败', 500); }
}

async function getPost(req, res) {
    try {
        const studio = await activeStudio(req.params.id);
        if (!studio) return errorResponse(res, '工作室不存在', 404);
        const post = await DbAdapter.findOne(StudioForumPost, {
            where: { id: req.params.postId, studio_id: studio.id, status: 'active' },
            include: [
                { model: User, as: 'author', attributes: authorFields },
                { model: StudioForumReply, as: 'replies', required: false, where: { status: 'active' }, include: [{ model: User, as: 'author', attributes: authorFields }] }
            ],
            order: [[{ model: StudioForumReply, as: 'replies' }, 'created_at', 'ASC']]
        });
        if (!post) return errorResponse(res, '主题不存在', 404);
        await StudioForumPost.increment('view_count', { where: { id: post.id } });
        post.setDataValue('view_count', Number(post.view_count || 0) + 1);
        return successResponse(res, post);
    } catch (error) { console.error('获取工作室论坛主题失败:', error); return errorResponse(res, '获取主题失败', 500); }
}

async function createPost(req, res) {
    try {
        const access = await requireMember(req, res); if (!access) return;
        const title = String(req.body.title || '').trim().slice(0, 200);
        const content = String(req.body.content || '').trim().slice(0, 20000);
        if (title.length < 2 || content.length < 2) return errorResponse(res, '标题和内容至少填写 2 个字', 400);
        const rejected = await reviewContent(`${title}\n${content}`);
        if (rejected) return errorResponse(res, `内容需要修改：${rejected}`, 400);
        const post = await DbAdapter.create(StudioForumPost, { studio_id: access.studio.id, user_id: currentUserId(req), title, content });
        await logOperation(req, 'forum_post_created', { targetType: 'studio_forum_post', targetId: post.id, after: { title }, isPublic: true });
        return successResponse(res, post, '主题已发布');
    } catch (error) { console.error('发布工作室论坛主题失败:', error); return errorResponse(res, '发布主题失败', 500); }
}

async function createReply(req, res) {
    try {
        const access = await requireMember(req, res); if (!access) return;
        const content = String(req.body.content || '').trim().slice(0, 5000);
        if (content.length < 1) return errorResponse(res, '请输入回复内容', 400);
        const post = await DbAdapter.findOne(StudioForumPost, { where: { id: req.params.postId, studio_id: access.studio.id, status: 'active' } });
        if (!post) return errorResponse(res, '主题不存在', 404);
        if (post.is_locked) return errorResponse(res, '该主题已锁定，暂不能回复', 400);
        const rejected = await reviewContent(content);
        if (rejected) return errorResponse(res, `内容需要修改：${rejected}`, 400);
        const reply = await sequelize.transaction(async transaction => {
            const row = await StudioForumReply.create({ post_id: post.id, user_id: currentUserId(req), content }, { transaction });
            await StudioForumPost.increment('reply_count', { where: { id: post.id }, transaction });
            await StudioForumPost.update({ last_reply_at: new Date() }, { where: { id: post.id }, transaction });
            return row;
        });
        return successResponse(res, reply, '回复已发布');
    } catch (error) { console.error('回复工作室论坛主题失败:', error); return errorResponse(res, '发布回复失败', 500); }
}

async function updatePostState(req, res) {
    try {
        const access = await requireMember(req, res); if (!access) return;
        if (!effectivePermissions(access.member).includes('member_manage')) return errorResponse(res, '无权管理论坛主题', 403);
        const post = await DbAdapter.findOne(StudioForumPost, { where: { id: req.params.postId, studio_id: access.studio.id, status: 'active' } });
        if (!post) return errorResponse(res, '主题不存在', 404);
        const values = {};
        if (typeof req.body.is_pinned === 'boolean') values.is_pinned = req.body.is_pinned;
        if (typeof req.body.is_locked === 'boolean') values.is_locked = req.body.is_locked;
        if (!Object.keys(values).length) return errorResponse(res, '没有可更新的设置', 400);
        await post.update(values);
        await logOperation(req, 'forum_post_state_updated', { targetType: 'studio_forum_post', targetId: post.id, after: values });
        return successResponse(res, post, '主题设置已更新');
    } catch (error) { return errorResponse(res, '更新主题失败', 500); }
}

async function deletePost(req, res) {
    try {
        const access = await requireMember(req, res); if (!access) return;
        const post = await DbAdapter.findOne(StudioForumPost, { where: { id: req.params.postId, studio_id: access.studio.id, status: 'active' } });
        if (!post) return errorResponse(res, '主题不存在', 404);
        const canManage = effectivePermissions(access.member).includes('member_manage');
        if (!canManage && String(post.user_id) !== String(currentUserId(req))) return errorResponse(res, '无权删除该主题', 403);
        await post.update({ status: 'deleted' });
        await logOperation(req, 'forum_post_deleted', { targetType: 'studio_forum_post', targetId: post.id, reason: String(req.body.reason || '').trim().slice(0, 500) });
        return successResponse(res, null, '主题已删除');
    } catch (error) { return errorResponse(res, '删除主题失败', 500); }
}

async function deleteReply(req, res) {
    try {
        const access = await requireMember(req, res); if (!access) return;
        const post = await DbAdapter.findOne(StudioForumPost, { where: { id: req.params.postId, studio_id: access.studio.id, status: 'active' } });
        const reply = post && await DbAdapter.findOne(StudioForumReply, { where: { id: req.params.replyId, post_id: post.id, status: 'active' } });
        if (!reply) return errorResponse(res, '回复不存在', 404);
        const canManage = effectivePermissions(access.member).includes('member_manage');
        if (!canManage && String(reply.user_id) !== String(currentUserId(req))) return errorResponse(res, '无权删除该回复', 403);
        await sequelize.transaction(async transaction => {
            await reply.update({ status: 'deleted' }, { transaction });
            await StudioForumPost.decrement('reply_count', { by: 1, where: { id: post.id, reply_count: { [Op.gt]: 0 } }, transaction });
        });
        await logOperation(req, 'forum_reply_deleted', { targetType: 'studio_forum_reply', targetId: reply.id });
        return successResponse(res, null, '回复已删除');
    } catch (error) { return errorResponse(res, '删除回复失败', 500); }
}

module.exports = { listPosts, getPost, createPost, createReply, updatePostState, deletePost, deleteReply };

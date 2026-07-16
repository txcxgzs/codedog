const { PostRevision, ForumModerationLog } = require('../models');

function snapshotPost(post) {
    const plain = post?.toJSON ? post.toJSON() : post || {};
    return {
        title: plain.title || '',
        content: plain.content || '',
        board_id: plain.board_id || null,
        post_type: plain.post_type || plain.category || 'discussion',
        cover: plain.cover || '',
        tags: Array.isArray(plain.tags) ? plain.tags : []
    };
}

async function recordPostRevision(post, editorId, source = 'user', changeReason = '', options = {}) {
    const postId = Number(post.id);
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const maxRevision = Number(await PostRevision.max('revision_number', { where: { post_id: postId }, transaction: options.transaction }) || 0);
        try {
            return await PostRevision.create({
                post_id: postId,
                revision_number: maxRevision + 1,
                editor_id: editorId ? Number(editorId) : null,
                source,
                change_reason: String(changeReason || '').trim().slice(0, 500),
                ...snapshotPost(post)
            }, { transaction: options.transaction });
        } catch (error) {
            if (error.name !== 'SequelizeUniqueConstraintError' || attempt === 2) throw error;
        }
    }
    return null;
}

async function recordModerationLog(postId, operatorId, action, reason, beforeState, afterState, options = {}) {
    return ForumModerationLog.create({
        post_id: Number(postId),
        operator_id: operatorId ? Number(operatorId) : null,
        action: String(action || '').slice(0, 50),
        reason: String(reason || '').trim().slice(0, 500),
        before_state: beforeState ? JSON.stringify(beforeState) : null,
        after_state: afterState ? JSON.stringify(afterState) : null
    }, { transaction: options.transaction });
}

module.exports = { snapshotPost, recordPostRevision, recordModerationLog };

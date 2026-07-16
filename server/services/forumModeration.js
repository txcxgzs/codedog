const { ForumBoardModerator } = require('../models');
const { isRoleAtLeast } = require('../config/permissions');

async function getModeratedBoardIds(user) {
    if (!user) return [];
    if (isRoleAtLeast(user.role, 'admin')) return null;
    if (user.role !== 'moderator') return [];
    const assignments = await ForumBoardModerator.findAll({
        where: { user_id: Number(user.id) },
        attributes: ['board_id'],
        raw: true
    });
    return assignments.map(item => Number(item.board_id));
}

async function canModerateBoard(user, boardId) {
    const boardIds = await getModeratedBoardIds(user);
    return boardIds === null || boardIds.includes(Number(boardId));
}

module.exports = { getModeratedBoardIds, canModerateBoard };

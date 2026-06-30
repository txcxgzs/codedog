const DbAdapter = require('../utils/dbAdapter');
const { Favorite, Work, User, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const { Op } = require('sequelize');
const { likeContains } = require('../utils/security');

function canInteractWithWork(work) {
    return work && work.status === 'published';
}

async function resolveWork(workId) {
    let work = await DbAdapter.findByPk(Work, workId);
    if (!work) {
        work = await DbAdapter.findOne(Work, { where: { codemao_work_id: String(workId) } });
    }
    return work;
}

async function favoriteWorksForUser(userId, query) {
    const page = parseInt(query.page, 10) || 1;
    const pageSize = parseInt(query.pageSize, 10) || 20;
    const keyword = query.keyword || '';

    const workWhere = { status: 'published' };
    if (keyword) {
        const keywordWhere = likeContains(sequelize, ['name', 'description'], keyword);
        if (keywordWhere) Object.assign(workWhere, keywordWhere);
    }

    const { count, rows } = await DbAdapter.findAndCountAll(Favorite, {
        where: { user_id: userId },
        include: [{
            model: Work,
            as: 'work',
            where: workWhere,
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }]
        }],
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize
    });

    const works = rows.filter(f => f.work).map(f => ({
        ...f.work.toJSON(),
        author: f.work.author,
        favoriteId: f.id,
        favoritedAt: f.created_at
    }));

    return { works, count };
}

async function addFavorite(req, res) {
    try {
        const { workId } = req.body;

        if (!workId) {
            return errorResponse(res, 'Please provide a work id', 400);
        }

        const work = await resolveWork(workId);
        if (!work || !canInteractWithWork(work)) {
            return errorResponse(res, 'Work not found', 404);
        }

        const localWorkId = DbAdapter.getId(work);
        const userId = DbAdapter.getId(req.user);

        const existing = await DbAdapter.findOne(Favorite, {
            where: { user_id: userId, work_id: localWorkId }
        });

        if (existing) {
            return errorResponse(res, 'Already favorited', 400);
        }

        try {
            await DbAdapter.create(Favorite, {
                user_id: userId,
                work_id: localWorkId
            });
        } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
                return errorResponse(res, 'Already favorited', 400);
            }
            throw createError;
        }

        await DbAdapter.increment(work, 'collection_times');
        await work.reload();

        return successResponse(res, { collection_times: work.collection_times || 0, favorited: true }, 'Favorite added');
    } catch (error) {
        console.error('Favorite error:', error);
        return errorResponse(res, 'Favorite failed', 500);
    }
}

async function removeFavorite(req, res) {
    try {
        const { workId } = req.params;
        const work = await resolveWork(workId);
        const localWorkId = work ? DbAdapter.getId(work) : workId;

        const favorite = await DbAdapter.findOne(Favorite, {
            where: { user_id: DbAdapter.getId(req.user), work_id: localWorkId }
        });

        if (!favorite) {
            return errorResponse(res, 'Not favorited', 400);
        }

        const removed = await DbAdapter.destroy(Favorite, { where: { id: DbAdapter.getId(favorite) } });

        if (removed && work && (work.collection_times || 0) > 0) {
            await DbAdapter.decrement(work, 'collection_times');
            await work.reload();
        }

        return successResponse(res, {
            collection_times: work ? Math.max(0, work.collection_times || 0) : 0,
            favorited: false
        }, 'Favorite removed');
    } catch (error) {
        console.error('Remove favorite error:', error);
        return errorResponse(res, 'Remove favorite failed', 500);
    }
}

async function getMyFavorites(req, res) {
    try {
        const { works, count } = await favoriteWorksForUser(DbAdapter.getId(req.user), req.query);
        return successResponse(res, { list: works, total: count });
    } catch (error) {
        console.error('Get favorites error:', error);
        return errorResponse(res, 'Failed to get favorites', 500);
    }
}

async function getUserFavorites(req, res) {
    try {
        const { codemaoUserId } = req.params;
        const user = await DbAdapter.findOne(User, {
            where: { codemao_user_id: String(codemaoUserId) },
            attributes: ['id']
        });

        if (!user) {
            return successResponse(res, { list: [], total: 0 });
        }

        const { works, count } = await favoriteWorksForUser(DbAdapter.getId(user), req.query);
        return successResponse(res, { list: works, total: count });
    } catch (error) {
        console.error('Get user favorites error:', error);
        return errorResponse(res, 'Failed to get favorites', 500);
    }
}

async function checkFavorite(req, res) {
    try {
        const { workId } = req.params;
        const work = await resolveWork(workId);
        if (!work) {
            return successResponse(res, { isFavorited: false });
        }

        const favorite = await DbAdapter.findOne(Favorite, {
            where: { user_id: DbAdapter.getId(req.user), work_id: DbAdapter.getId(work) }
        });

        return successResponse(res, { isFavorited: !!favorite });
    } catch (error) {
        console.error('Check favorite error:', error);
        return errorResponse(res, 'Check favorite failed', 500);
    }
}

module.exports = {
    addFavorite,
    removeFavorite,
    getMyFavorites,
    getUserFavorites,
    checkFavorite
};

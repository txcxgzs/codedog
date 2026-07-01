const DbAdapter = require('../utils/dbAdapter');
const { Favorite, Work, Post, User, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { Op } = require('sequelize');
const { likeContains } = require('../utils/security');

function canInteractWithWork(work) {
    return work && work.status === 'published';
}

async function resolveWork(workId) {
    let work = await DbAdapter.findOne(Work, { where: { codemao_work_id: String(workId) } });
    if (!work && /^\d+$/.test(String(workId))) {
        work = await DbAdapter.findByPk(Work, workId);
    }
    return work;
}

async function favoriteWorksForUser(userId, query) {
    // M3: 统一使用 DbAdapter.parsePagination 限制 pageSize 上限(<=100)
    const { page, pageSize, offset } = DbAdapter.parsePagination(query);
    const keyword = query.keyword || '';

    const workWhere = { status: 'published' };
    if (keyword) {
        const keywordWhere = likeContains(sequelize, ['name', 'description'], keyword);
        if (keywordWhere) Object.assign(workWhere, keywordWhere);
    }

    const postWhere = { status: 'published' };
    if (keyword) {
        const postKeywordWhere = likeContains(sequelize, ['title', 'content'], keyword);
        if (postKeywordWhere) Object.assign(postWhere, postKeywordWhere);
    }

    // M13: 取消 limit:500 截断，改为按需分页拉取，避免大量收藏被静默丢弃
    // 由于收藏混合作品与帖子两类来源，先取全部已发布的收藏记录，合并排序后再分页
    const [workFavorites, postFavorites] = await Promise.all([
        DbAdapter.findAndCountAll(Favorite, {
            where: { user_id: userId, work_id: { [Op.ne]: null } },
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
            order: [['created_at', 'DESC']]
        }),
        DbAdapter.findAndCountAll(Favorite, {
            where: { user_id: userId, post_id: { [Op.ne]: null } },
            include: [{
                model: Post,
                as: 'post',
                where: postWhere,
                include: [{
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'nickname', 'avatar']
                }]
            }],
            order: [['created_at', 'DESC']]
        })
    ]);

    const workItems = workFavorites.rows.filter(f => f.work).map(f => ({
        ...f.work.toJSON(),
        favoriteId: f.id,
        favoritedAt: f.created_at,
        _type: 'work'
    }));

    const postItems = postFavorites.rows.filter(f => f.post).map(f => ({
        ...f.post.toJSON(),
        favoriteId: f.id,
        favoritedAt: f.created_at,
        _type: 'post'
    }));

    const allItems = [...workItems, ...postItems].sort((a, b) => new Date(b.favoritedAt) - new Date(a.favoritedAt));
    const total = allItems.length;
    const pagedItems = allItems.slice(offset, offset + pageSize);

    return { works: pagedItems, count: total, page, pageSize };
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
        const { works, count, page, pageSize } = await favoriteWorksForUser(DbAdapter.getId(req.user), req.query);
        // L1: 统一使用 paginateResponse 返回，包含 pagination 字段
        return paginateResponse(res, works, count, page, pageSize);
    } catch (error) {
        console.error('Get favorites error:', error);
        return errorResponse(res, 'Failed to get favorites', 500);
    }
}

async function getUserFavorites(req, res) {
    try {
        const { codemaoUserId } = req.params;

        if (String(req.user.codemao_user_id) !== String(codemaoUserId)) {
            return errorResponse(res, '无权查看其他用户收藏', 403);
        }

        const user = await DbAdapter.findOne(User, {
            where: { codemao_user_id: String(codemaoUserId) },
            attributes: ['id']
        });

        if (!user) {
            const { page, pageSize } = DbAdapter.parsePagination(req.query);
            return paginateResponse(res, [], 0, page, pageSize);
        }

        const { works, count, page, pageSize } = await favoriteWorksForUser(DbAdapter.getId(user), req.query);
        return paginateResponse(res, works, count, page, pageSize);
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

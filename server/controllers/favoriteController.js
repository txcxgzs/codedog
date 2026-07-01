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

    // 关键词过滤条件(用于查询 Work/Post 详情时下推到 SQL)
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

    // 第一步:SQL 分页查询该用户的所有收藏(按收藏时间倒序)
    // 不在此处关联 Work/Post 详情,避免全量加载后再内存 slice
    // 排序与分页(limit/offset)均下推到 SQL,内存中不再做 .slice()
    const { rows: favorites, count: total } = await DbAdapter.findAndCountAll(Favorite, {
        where: {
            user_id: userId,
            [Op.or]: [
                { work_id: { [Op.ne]: null } },
                { post_id: { [Op.ne]: null } }
            ]
        },
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: offset
    });

    if (favorites.length === 0) {
        return { works: [], count: total, page, pageSize };
    }

    // 第二步:从当前页的收藏中分离出作品 ID 和帖子 ID
    const workIds = favorites.filter(f => f.work_id).map(f => f.work_id);
    const postIds = favorites.filter(f => f.post_id).map(f => f.post_id);

    // 第三步:批量查询当前页收藏对应的 Work 和 Post 详情
    // 仅查询当前页涉及的记录,避免全量加载;keyword 过滤在此处应用
    const [works, posts] = await Promise.all([
        workIds.length > 0 ? DbAdapter.findAll(Work, {
            where: { id: { [Op.in]: workIds }, ...workWhere },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }]
        }) : [],
        postIds.length > 0 ? DbAdapter.findAll(Post, {
            where: { id: { [Op.in]: postIds }, ...postWhere },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }]
        }) : []
    ]);

    // 第四步:构建 id->详情 映射,便于按收藏顺序组装结果
    const workMap = new Map(works.map(w => [DbAdapter.getId(w), w]));
    const postMap = new Map(posts.map(p => [DbAdapter.getId(p), p]));

    // 第五步:按收藏记录的顺序(已按 created_at DESC 排序)组装结果
    // 若 Work/Post 不存在或被 keyword 过滤掉,则跳过该条收藏
    const items = [];
    for (const f of favorites) {
        if (f.work_id) {
            const work = workMap.get(f.work_id);
            if (work) {
                items.push({
                    ...work.toJSON(),
                    favoriteId: f.id,
                    favoritedAt: f.created_at,
                    _type: 'work'
                });
            }
        } else if (f.post_id) {
            const post = postMap.get(f.post_id);
            if (post) {
                items.push({
                    ...post.toJSON(),
                    favoriteId: f.id,
                    favoritedAt: f.created_at,
                    _type: 'post'
                });
            }
        }
    }

    return { works: items, count: total, page, pageSize };
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

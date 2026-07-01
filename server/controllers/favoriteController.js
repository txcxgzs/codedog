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

    // 关键词 + 状态过滤条件(下推到 Work/Post 查询)
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

    // 修复: 先过滤再分页,避免"分页后再过滤"导致搜索遗漏、空页、count 不准
    // 第一步: 获取该用户所有收藏的 work_id / post_id(仅取 ID,轻量)
    const userFavoriteLinks = await DbAdapter.findAll(Favorite, {
        where: {
            user_id: userId,
            [Op.or]: [
                { work_id: { [Op.ne]: null } },
                { post_id: { [Op.ne]: null } }
            ]
        },
        attributes: ['work_id', 'post_id']
    });
    const allWorkIds = userFavoriteLinks.filter(f => f.work_id).map(f => f.work_id);
    const allPostIds = userFavoriteLinks.filter(f => f.post_id).map(f => f.post_id);

    // 第二步: 在这些收藏中,筛选出满足 status+keyword 条件的 Work/Post 的本地 ID
    // 过滤必须在分页之前完成,否则会出现空页、count 不准、搜索遗漏等问题
    const [matchingWorks, matchingPosts] = await Promise.all([
        allWorkIds.length > 0 ? DbAdapter.findAll(Work, {
            where: { id: { [Op.in]: allWorkIds }, ...workWhere },
            attributes: ['id']
        }) : [],
        allPostIds.length > 0 ? DbAdapter.findAll(Post, {
            where: { id: { [Op.in]: allPostIds }, ...postWhere },
            attributes: ['id']
        }) : []
    ]);
    const matchingWorkIds = matchingWorks.map(w => DbAdapter.getId(w));
    const matchingPostIds = matchingPosts.map(p => DbAdapter.getId(p));

    // 第三步: 在已过滤的收藏集合上分页(count 为过滤后的总数,非原始收藏总数)
    const { rows: favorites, count: total } = await DbAdapter.findAndCountAll(Favorite, {
        where: {
            user_id: userId,
            [Op.or]: [
                { work_id: { [Op.in]: matchingWorkIds } },
                { post_id: { [Op.in]: matchingPostIds } }
            ]
        },
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: offset
    });

    if (favorites.length === 0) {
        return { works: [], count: total, page, pageSize };
    }

    // 第四步: 批量加载当前页收藏对应的 Work/Post 详情(含 author)
    const pageWorkIds = favorites.filter(f => f.work_id).map(f => f.work_id);
    const pagePostIds = favorites.filter(f => f.post_id).map(f => f.post_id);

    const [works, posts] = await Promise.all([
        pageWorkIds.length > 0 ? DbAdapter.findAll(Work, {
            where: { id: { [Op.in]: pageWorkIds } },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }]
        }) : [],
        pagePostIds.length > 0 ? DbAdapter.findAll(Post, {
            where: { id: { [Op.in]: pagePostIds } },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }]
        }) : []
    ]);

    // 第五步: 构建 id->详情 映射,按收藏顺序组装结果
    const workMap = new Map(works.map(w => [DbAdapter.getId(w), w]));
    const postMap = new Map(posts.map(p => [DbAdapter.getId(p), p]));

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

        // 修复: create Favorite + increment collection_times 用事务包裹,中途失败回滚避免不一致
        try {
            await sequelize.transaction(async (t) => {
                await DbAdapter.create(Favorite, {
                    user_id: userId,
                    work_id: localWorkId
                }, { transaction: t });
                await DbAdapter.increment(work, 'collection_times', { transaction: t });
            });
        } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
                return errorResponse(res, 'Already favorited', 400);
            }
            throw createError;
        }

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
        const userId = DbAdapter.getId(req.user);
        const work = await resolveWork(workId);
        let localWorkId = work ? DbAdapter.getId(work) : null;

        // P3-11 修复: work 不存在(可能被硬删除)时的回退。
        // Favorite.work_id 存的是本地整型主键,不是 codemao_work_id。
        // 若 workId 是 codemao_work_id(字符串),直接用作 work_id 永远匹配不到。
        // 鲁棒解析(Favorite 模型无 codemao_work_id 列):
        //  1. workId 为纯数字时,可能就是本地主键,直接用作 work_id 查找。
        //  2. workId 为 codemao_work_id(字符串)时,扫描用户的作品收藏,通过关联的
        //     (可能被软删除的)Work 的 codemao_work_id 匹配,取其本地主键。
        if (!localWorkId) {
            if (/^\d+$/.test(String(workId))) {
                localWorkId = Number(workId);
            } else {
                const userFav = await DbAdapter.findOne(Favorite, {
                    where: { user_id: userId, work_id: { [Op.ne]: null } },
                    include: [{
                        model: Work,
                        as: 'work',
                        where: { codemao_work_id: String(workId) },
                        required: true
                    }]
                });
                if (userFav) {
                    localWorkId = userFav.work_id;
                }
            }
        }

        if (!localWorkId) {
            return errorResponse(res, 'Not favorited', 400);
        }

        const favorite = await DbAdapter.findOne(Favorite, {
            where: { user_id: userId, work_id: localWorkId }
        });

        if (!favorite) {
            return errorResponse(res, 'Not favorited', 400);
        }

        // 修复: destroy Favorite + decrement collection_times 用事务包裹,保证一致性;
        // 原子条件 decrement: 仅当 collection_times > 0 时才减 1,避免并发导致负数(镜像 commentController)
        await sequelize.transaction(async (t) => {
            const removed = await DbAdapter.destroy(Favorite, {
                where: { id: DbAdapter.getId(favorite) },
                transaction: t
            });
            if (removed && work) {
                await DbAdapter.decrement(work, 'collection_times', {
                    where: { collection_times: { [Op.gt]: 0 } },
                    transaction: t
                });
            }
        });

        if (work) {
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

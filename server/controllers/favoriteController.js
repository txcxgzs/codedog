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

    // 修复(报告1 #12): 上一轮虽修正了"先过滤再分页",但仍把该用户全部收藏的
    // work_id/post_id 拉到内存后再 JS 过滤,对收藏数多的用户有内存/性能风险。
    // 这里把 过滤 + 分页 + count 全部下推到 SQL,内存只持有当前页数据:
    //  - Favorite 是多态(work_id / post_id 由 hasTarget 校验恰一非空),通过两次
    //    LEFT JOIN Work/Post 并在各自 include.where 上施加 status+keyword 过滤。
    //  - 外层 Op.or($work.id$ / $post.id$ IS NOT NULL) 只保留两侧至少一侧匹配
    //    的收藏;由于 work_id 与 post_id 互斥,每条收藏至多匹配一行 JOIN 结果,
    //    不会产生重复行,故 count(*) 准确(直接来自过滤后的查询,非预过滤总数)。
    //  - subQuery:false 使 limit/offset 与 count 直接作用于 JOIN 后的结果集
    //    (而非先对 favorites 取子集再 JOIN),保证分页与 count 一致。
    //  - Work/Post 的 author 通过嵌套 include 一并取出,无需后续二次查询。
    const { rows: favorites, count: total } = await DbAdapter.findAndCountAll(Favorite, {
        where: {
            user_id: userId,
            [Op.or]: [
                { '$work.id$': { [Op.ne]: null } },
                { '$post.id$': { [Op.ne]: null } }
            ]
        },
        include: [
            {
                model: Work,
                as: 'work',
                required: false,
                where: workWhere,
                include: [{
                    model: User,
                    as: 'author',
                    attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
                }]
            },
            {
                model: Post,
                as: 'post',
                required: false,
                where: postWhere,
                include: [{
                    model: User,
                    as: 'author',
                    attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
                }]
            }
        ],
        // 修复: Favorite 是本次 findAndCountAll 的主模型(根表),不是被 include 的关联模型。
        // [模型, 列, 方向] 语法只适用于关联模型排序;对根模型会报 "Favorite is not associated to Favorite"。
        // 改为最简单的 [列, 方向] 形式,Sequelize 会自动用主表别名限定。
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: offset,
        subQuery: false
    });

    if (favorites.length === 0) {
        return { works: [], count: total, page, pageSize };
    }

    // 按收藏顺序组装结果(Work/Post + author 已通过 include 一并取出)
    const items = [];
    for (const f of favorites) {
        if (f.work) {
            items.push({
                ...f.work.toJSON(),
                favoriteId: f.id,
                favoritedAt: f.created_at,
                _type: 'work'
            });
        } else if (f.post) {
            items.push({
                ...f.post.toJSON(),
                favoriteId: f.id,
                favoritedAt: f.created_at,
                _type: 'post'
            });
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
        let work = await resolveWork(workId);
        let localWorkId = work ? DbAdapter.getId(work) : null;

        // Bug-20: 修复数字ID混淆——当 workId 为数字且 resolveWork 通过本地 PK 匹配到了 work
        // 但该 work 的 codemao_work_id 并不等于传入的 workId 时,可能误删不同作品的收藏
        if (work && /^\d+$/.test(String(workId)) && String(work.codemao_work_id) !== String(workId)) {
            // resolveWork 回退到本地 PK 查到了一个 codemao_work_id 不匹配的作品
            const byCodemao = await DbAdapter.findOne(Work, { where: { codemao_work_id: String(workId) } });
            if (!byCodemao) {
                // workId 既不是 codemao_work_id,本地的PK又指向不同作品的work,直接拒绝
                console.warn(`[removeFavorite] 拒绝: workId=${workId} 本地PK指向 codemao_work_id=${work.codemao_work_id},不匹配`);
                return errorResponse(res, 'Work not found', 404);
            }
            // byCodemao 存在: 说明 codemao_work_id 匹配,用 byCodemao 替代 work
            work = byCodemao;
            localWorkId = DbAdapter.getId(work);
        }

        if (!localWorkId) {
            if (/^\d+$/.test(String(workId))) {
                // 纯数字:作为本地主键查找 Favorite
                localWorkId = Number(workId);
            } else {
                // 非数字:通过 JOIN Work.codemao_work_id 查找
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

        // 原子条件 decrement: 使用模型级 decrement 保证 where 条件不被忽略
        await sequelize.transaction(async (t) => {
            const removed = await DbAdapter.destroy(Favorite, {
                where: { id: DbAdapter.getId(favorite) },
                transaction: t
            });
            if (removed && work) {
                await DbAdapter.decrement(Work, 'collection_times', {
                    where: { id: localWorkId, collection_times: { [Op.gt]: 0 } },
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

        const user = await DbAdapter.findOne(User, {
            where: { codemao_user_id: String(codemaoUserId) },
            attributes: ['id', 'codemao_user_id', 'show_favorites']
        });

        if (!user) {
            const { page, pageSize } = DbAdapter.parsePagination(req.query);
            return paginateResponse(res, [], 0, page, pageSize);
        }

        const isOwner = req.user && String(req.user.codemao_user_id) === String(codemaoUserId);
        if (!isOwner && !user.show_favorites) {
            return errorResponse(res, '该用户未公开收藏夹', 403);
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

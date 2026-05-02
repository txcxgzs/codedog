const DbAdapter = require('../utils/dbAdapter');
/**
 * 收藏控制器
 */

const { Favorite, Work, User, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const { Op } = require('sequelize');

/**
 * 收藏作品
 */
async function addFavorite(req, res) {
    try {
        const { workId } = req.body;
        
        if (!workId) {
            return errorResponse(res, '请提供作品ID', 400);
        }
        
        let work = await DbAdapter.findByPk(Work, workId);
        if (!work) {
            work = await DbAdapter.findOne(Work, { where: { codemao_work_id: workId } });
        }
        
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        const localWorkId = DbAdapter.getId(work);
        
        const existing = await DbAdapter.findOne(Favorite, {
            where: { user_id: req.user.id, work_id: localWorkId }
        });
        
        if (existing) {
            return errorResponse(res, '已收藏该作品', 400);
        }
        
        await DbAdapter.create(Favorite, {
            user_id: req.user.id,
            work_id: localWorkId
        });

        await DbAdapter.increment(work, 'collection_times');
        const updatedWork = await DbAdapter.findByPk(Work, DbAdapter.getId(work), { attributes: ['collection_times'] });

        return successResponse(res, { collection_times: updatedWork.collection_times, favorited: true }, '收藏成功');
    } catch (error) {
        console.error('收藏错误:', error);
        return errorResponse(res, '收藏失败', 500);
    }
}

/**
 * 取消收藏
 */
async function removeFavorite(req, res) {
    try {
        const { workId } = req.params;
        
        let work = null;
        let localWorkId = workId;
        if (isNaN(workId) || workId.length > 10) {
            work = await DbAdapter.findOne(Work, { where: { codemao_work_id: workId } });
            if (work) {
                localWorkId = DbAdapter.getId(work);
            }
        } else {
            work = await DbAdapter.findByPk(Work, localWorkId);
        }
        
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        const favorite = await DbAdapter.findOne(Favorite, {
            where: { user_id: req.user.id, work_id: localWorkId }
        });
        
        if (!favorite) {
            return errorResponse(res, '未收藏该作品', 400);
        }
        
        await DbAdapter.destroy(Favorite, { where: { id: DbAdapter.getId(favorite) } });

        await DbAdapter.decrement(work, 'collection_times');
        const updatedWork = await DbAdapter.findByPk(Work, localWorkId, { attributes: ['collection_times'] });

        return successResponse(res, { collection_times: Math.max(0, updatedWork.collection_times), favorited: false }, '已取消收藏');
    } catch (error) {
        console.error('取消收藏错误:', error);
        return errorResponse(res, '取消收藏失败', 500);
    }
}

/**
 * 获取我的收藏列表
 */
async function getMyFavorites(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const keyword = req.query.keyword || '';
        
        const workWhere = {};
        if (keyword) {
            workWhere[Op.or] = [
                { name: { [Op.like]: `%${keyword}%` } },
                { description: { [Op.like]: `%${keyword}%` } }
            ];
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(Favorite, {
            where: { user_id: req.user.id },
            include: [{
                model: Work,
                as: 'work',
                where: keyword ? workWhere : undefined,
                include: [{
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'nickname', 'avatar']
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
        
        return successResponse(res, { list: works, total: count });
    } catch (error) {
        console.error('获取收藏列表错误:', error);
        return errorResponse(res, '获取收藏列表失败', 500);
    }
}

/**
 * 检查是否已收藏
 */
async function checkFavorite(req, res) {
    try {
        const { workId } = req.params;
        
        let localWorkId = workId;
        if (isNaN(workId) || workId.length > 10) {
            const work = await DbAdapter.findOne(Work, { where: { codemao_work_id: workId } });
            if (work) {
                localWorkId = DbAdapter.getId(work);
            } else {
                return successResponse(res, { isFavorited: false });
            }
        } else {
            const work = await DbAdapter.findByPk(Work, localWorkId);
            if (!work) {
                return successResponse(res, { isFavorited: false });
            }
        }
        
        const favorite = await DbAdapter.findOne(Favorite, {
            where: { user_id: req.user.id, work_id: localWorkId }
        });
        
        return successResponse(res, { isFavorited: !!favorite });
    } catch (error) {
        console.error('检查收藏错误:', error);
        return errorResponse(res, '检查收藏失败', 500);
    }
}

module.exports = {
    addFavorite,
    removeFavorite,
    getMyFavorites,
    checkFavorite
};

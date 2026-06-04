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
    const transaction = await sequelize.transaction();
    try {
        const { workId } = req.body;
        
        if (!workId) {
            await transaction.rollback();
            return errorResponse(res, '请提供作品ID', 400);
        }
        
        let work = await DbAdapter.findByPk(Work, workId, { lock: true, transaction });
        if (!work) {
            work = await DbAdapter.findOne(Work, { where: { codemao_work_id: workId }, lock: true, transaction });
        }
        
        if (!work) {
            await transaction.rollback();
            return errorResponse(res, '作品不存在', 404);
        }
        
        const localWorkId = DbAdapter.getId(work);
        
        // 使用 findOrCreate 防止并发重复收藏
        const [favorite, created] = await DbAdapter.findOrCreate(Favorite, {
            where: { user_id: req.user.id, work_id: localWorkId },
            defaults: {
                user_id: req.user.id,
                work_id: localWorkId
            },
            transaction
        });
        
        if (!created) {
            await transaction.rollback();
            return errorResponse(res, '已收藏该作品', 400);
        }
        
        // 使用原子 increment 操作更新收藏数
        await work.increment('collection_times', { transaction });
        
        await transaction.commit();
        return successResponse(res, null, '收藏成功');
    } catch (error) {
        await transaction.rollback();
        console.error('收藏错误:', error);
        return errorResponse(res, '收藏失败', 500);
    }
}

/**
 * 取消收藏
 */
async function removeFavorite(req, res) {
    const transaction = await sequelize.transaction();
    try {
        const { workId } = req.params;
        
        let localWorkId = workId;
        let work = null;
        if (isNaN(workId) || workId.length > 10) {
            work = await DbAdapter.findOne(Work, { where: { codemao_work_id: workId }, lock: true, transaction });
            if (work) {
                localWorkId = DbAdapter.getId(work);
            }
        } else {
            work = await DbAdapter.findByPk(Work, localWorkId, { lock: true, transaction });
        }
        
        const favorite = await DbAdapter.findOne(Favorite, {
            where: { user_id: req.user.id, work_id: localWorkId },
            lock: true,
            transaction
        });
        
        if (!favorite) {
            await transaction.rollback();
            return errorResponse(res, '未收藏该作品', 400);
        }
        
        await DbAdapter.destroy(Favorite, { where: { id: DbAdapter.getId(favorite) }, transaction });
        
        if (work) {
            // 使用原子 decrement 操作更新收藏数
            await work.decrement('collection_times', { transaction });
        }
        
        await transaction.commit();
        return successResponse(res, null, '已取消收藏');
    } catch (error) {
        await transaction.rollback();
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

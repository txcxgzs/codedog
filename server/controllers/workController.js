/**
 * 作品控制器
 */

const { Work, User } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { Op } = require('sequelize');
const DbAdapter = require('../utils/dbAdapter');
const codemaoApi = require('../services/codemaoApi');

/**
 * 从编程猫API获取作品信息
 */
async function fetchCodemaoWork(workId) {
    try {
        const data = await codemaoApi.getWorkDetail(workId);
        
        if (!data || !data.id) {
            console.error('获取编程猫作品失败: 返回数据为空或无效');
            return null;
        }
        
        if (!data.work_name) {
            console.error('获取编程猫作品失败: 作品名称为空');
            return null;
        }
        
        return {
            codemaoWorkId: data.id,
            name: data.work_name,
            description: data.description || '',
            preview: data.preview || '',
            type: data.type || data.work_label_list?.[0]?.label_name || '其他',
            ideType: data.ide_type || 'KITTEN',
            playerUrl: data.player_url || '',
            codemaoAuthorId: data.user_info?.id || null,
            codemaoAuthorName: data.user_info?.nickname || '未知作者',
            praiseTimes: data.praise_times || data.liked_times || 0,
            collectionTimes: data.collect_times || 0,
            viewTimes: data.view_times || 0,
            commentTimes: data.comment_times || 0
        };
    } catch (error) {
        console.error('获取编程猫作品失败:', error.message);
        return null;
    }
}

/**
 * 构建 Work.create 参数
 */
function buildWorkCreateParams(workInfo, userId) {
    return {
        codemao_work_id: String(workInfo.codemaoWorkId),
        name: workInfo.name,
        description: workInfo.description,
        preview: workInfo.preview,
        type: workInfo.type || '其他',
        ide_type: workInfo.ideType || 'KITTEN',
        work_url: workInfo.playerUrl,
        user_id: userId,
        codemao_author_id: String(workInfo.codemaoAuthorId),
        codemao_author_name: workInfo.codemaoAuthorName,
        praise_times: workInfo.praiseTimes,
        collection_times: workInfo.collectionTimes,
        view_times: workInfo.viewTimes,
        comment_count: workInfo.commentTimes,
        status: 'published'
    };
}

/**
 * 确保编程猫用户存在，不存在则创建
 */
async function ensureCodemaoUser(userInfo) {
    let user = await DbAdapter.findOne(User, { 
        where: { codemao_user_id: userInfo.id } 
    });

    if (!user) {
        user = await DbAdapter.create(User, {
            codemao_user_id: userInfo.id,
            username: `codemao_${userInfo.id}`,
            email: `codemao_${userInfo.id}@placeholder.com`,
            password: '$2a$10$placeholder',
            nickname: userInfo.nickname,
            avatar: userInfo.avatar,
            bio: userInfo.description,
            role: 'user',
            status: 'active'
        });
    }

    return user;
}

/**
 * 发布作品
 */
async function publishWork(req, res) {
    try {
        const { codemaoWorkId } = req.body;
        
        if (!codemaoWorkId) {
            return errorResponse(res, '请输入编程猫作品ID', 400);
        }
        
        const workInfo = await fetchCodemaoWork(codemaoWorkId);
        
        if (!workInfo) {
            return errorResponse(res, '获取作品信息失败，请检查作品ID是否正确或作品是否公开', 400);
        }
        
        const [work, created] = await DbAdapter.findOrCreate(Work, {
            where: { codemao_work_id: String(codemaoWorkId) },
            defaults: buildWorkCreateParams(workInfo, DbAdapter.getId(req.user)),
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }]
        });
        
        if (!created) {
            return errorResponse(res, '该作品已在平台发布', 400);
        }
        
        const result = await DbAdapter.findByPk(Work, DbAdapter.getId(work), {
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }]
        });
        
        return successResponse(res, result, '作品发布成功');
    } catch (error) {
        console.error('发布作品错误:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return errorResponse(res, '该作品已在平台发布', 400);
        }
        return errorResponse(res, '发布作品失败', 500);
    }
}

/**
 * 获取作品列表
 */
async function getWorks(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const keyword = req.query.keyword || '';
        const type = req.query.type || '';
        const sortBy = req.query.sortBy || 'latest';
        
        const where = { status: 'published' };
        
        if (keyword) {
            where[Op.or] = [
                { name: { [Op.like]: `%${keyword}%` } },
                { description: { [Op.like]: `%${keyword}%` } }
            ];
        }
        
        if (type) {
            where.type = type;
        }
        
        let order = [['created_at', 'DESC']];
        if (sortBy === 'popular') {
            order = [['view_times', 'DESC']];
        } else if (sortBy === 'praise') {
            order = [['praise_times', 'DESC']];
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(Work, {
            where,
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }],
            order,
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取作品列表错误:', error);
        return errorResponse(res, '获取作品列表失败', 500);
    }
}

/**
 * 获取作品详情（使用编程猫ID）
 */
async function getWorkDetail(req, res) {
    try {
        const codemaoId = req.params.codemaoId;
        const { Like } = require('../models');
        
        const work = await DbAdapter.findOne(Work, {
            where: { codemao_work_id: String(codemaoId) },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio']
            }]
        });
        
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        await DbAdapter.increment(work, 'view_times');
        
        let liked = false;
        if (req.user) {
            const likeRecord = await DbAdapter.findOne(Like, {
                where: { user_id: DbAdapter.getId(req.user), work_id: DbAdapter.getId(work) }
            });
            liked = !!likeRecord;
        }
        
        return successResponse(res, { ...(work.toJSON ? work.toJSON() : work.toObject ? work.toObject() : work), liked });
    } catch (error) {
        console.error('获取作品详情错误:', error);
        return errorResponse(res, '获取作品详情失败', 500);
    }
}

/**
 * 通过编程猫ID获取作品
 */
async function getWorkByCodemaoId(req, res) {
    try {
        const { codemaoId } = req.params;
        
        let work = await DbAdapter.findOne(Work, {
            where: { codemao_work_id: String(codemaoId) },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio']
            }]
        });
        
        if (work) {
            await DbAdapter.increment(work, 'view_times');
            return successResponse(res, work.toJSON ? work.toJSON() : work);
        }
        
        const workInfo = await fetchCodemaoWork(codemaoId);
        
        if (!workInfo) {
            return errorResponse(res, '作品不存在或未公开', 404);
        }
        
        let author = null;
        if (workInfo.codemaoAuthorId) {
            author = await DbAdapter.findOne(User, {
                where: { codemao_user_id: String(workInfo.codemaoAuthorId) }
            });
        }
        
        try {
            work = await DbAdapter.create(Work, {
                codemao_work_id: String(workInfo.codemaoWorkId),
                name: workInfo.name,
                description: workInfo.description,
                preview: workInfo.preview,
                type: workInfo.type || '其他',
                ide_type: workInfo.ideType || 'KITTEN',
                work_url: workInfo.playerUrl,
                user_id: author ? DbAdapter.getId(author) : null,
                codemao_author_id: String(workInfo.codemaoAuthorId),
                codemao_author_name: workInfo.codemaoAuthorName,
                view_times: workInfo.viewTimes || 1,
                praise_times: workInfo.praiseTimes || 0,
                collection_times: workInfo.collectionTimes || 0,
                status: 'published'
            });
        } catch (createError) {
            if (createError.name === 'SequelizeUniqueConstraintError') {
                work = await DbAdapter.findOne(Work, {
                    where: { codemao_work_id: String(codemaoId) },
                    include: [{
                        model: User,
                        as: 'author',
                        attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio']
                    }]
                });
                if (work) {
                    return successResponse(res, work.toJSON ? work.toJSON() : work);
                }
            }
            throw createError;
        }
        
        return successResponse(res, work.toJSON ? work.toJSON() : work);
    } catch (error) {
        console.error('获取编程猫作品错误:', error);
        return errorResponse(res, '获取作品信息失败', 500);
    }
}

/**
 * 获取首页推荐作品
 */
async function getFeaturedWorks(req, res) {
    try {
        let works = await DbAdapter.findAll(Work, {
            where: {
                status: 'published',
                is_featured: true
            },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }],
            order: [['created_at', 'DESC']],
            limit: 15
        });
        
        if (works.length === 0) {
            works = await getHotWorksFromCodemao();
        }
        
        return successResponse(res, works);
    } catch (error) {
        console.error('获取推荐作品错误:', error);
        return errorResponse(res, '获取推荐作品失败', 500);
    }
}

/**
 * 从编程猫获取热门作品
 */
async function getHotWorksFromCodemao() {
    try {
        const bannersData = await codemaoApi.getBanners('OFFICIAL');
        const works = [];
        const seenIds = new Set();
        
        if (bannersData && bannersData.items) {
            for (const banner of bannersData.items.slice(0, 5)) {
                const workIdMatch = banner.target_url?.match(/work\/(\d+)/);
                if (!workIdMatch) continue;
                
                const workId = parseInt(workIdMatch[1]);
                if (seenIds.has(workId)) continue;
                seenIds.add(workId);
                
                const work = await fetchOrCreateWork(workId);
                if (work) works.push(work);
            }
        }
        
        if (works.length < 8) {
            const postsData = await codemaoApi.searchPosts('精选', 1, 30);
            if (postsData && postsData.items) {
                for (const post of postsData.items) {
                    if (works.length >= 8) break;
                    
                    const workIdMatch = post.content?.match(/work\/(\d+)/);
                    if (!workIdMatch) continue;
                    
                    const workId = parseInt(workIdMatch[1]);
                    if (seenIds.has(workId)) continue;
                    seenIds.add(workId);
                    
                    const work = await fetchOrCreateWork(workId);
                    if (work) works.push(work);
                }
            }
        }
        
        return works;
    } catch (error) {
        console.error('获取编程猫热门作品错误:', error);
        return [];
    }
}

/**
 * 获取或创建作品
 */
async function fetchOrCreateWork(workId) {
    let work = await DbAdapter.findOne(Work, { 
        where: { codemao_work_id: workId },
        include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
        }]
    });
    
    if (work) return work;
    
    const workDetail = await codemaoApi.getWorkDetail(workId);
    if (!workDetail || !workDetail.id || !workDetail.work_name) {
        console.error(`获取作品详情失败或数据无效: workId=${workId}`);
        return null;
    }
    
    const user = await ensureCodemaoUser(workDetail.user_info);
    
    const type = workDetail.work_label_list && workDetail.work_label_list[0] 
        ? workDetail.work_label_list[0].label_name 
        : '其他';
    
    const workInfo = {
        codemaoWorkId: workDetail.id,
        name: workDetail.work_name,
        description: workDetail.description || '',
        preview: workDetail.preview || '',
        type: type,
        ideType: workDetail.ide_type || 'KITTEN',
        workUrl: workDetail.player_url || '',
        codemaoAuthorId: workDetail.user_info?.id,
        codemaoAuthorName: workDetail.user_info?.nickname || '未知作者',
        viewTimes: workDetail.view_times || 0,
        praiseTimes: workDetail.liked_times || 0,
        collectionTimes: workDetail.collect_times || 0,
        commentTimes: workDetail.comment_times || 0
    };
    
    try {
        work = await DbAdapter.create(Work, buildWorkCreateParams(workInfo, DbAdapter.getId(user)));
    } catch (createError) {
        if (createError.name === 'SequelizeUniqueConstraintError') {
            work = await DbAdapter.findOne(Work, { 
                where: { codemao_work_id: workId },
                include: [{
                    model: User,
                    as: 'author',
                    attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
                }]
            });
            if (work) return work;
        }
        throw createError;
    }
    
    return await DbAdapter.findByPk(Work, DbAdapter.getId(work), {
        include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
        }]
    });
}

/**
 * 获取我的作品
 */
async function getMyWorks(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 12;
        
        const { count, rows } = await DbAdapter.findAndCountAll(Work, {
            where: { user_id: DbAdapter.getId(req.user) },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取我的作品错误:', error);
        return errorResponse(res, '获取我的作品失败', 500);
    }
}

/**
 * 获取用户发布的作品
 */
async function getUserWorks(req, res) {
    try {
        const userId = req.params.userId || DbAdapter.getId(req.user);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        
        const { count, rows } = await DbAdapter.findAndCountAll(Work, {
            where: { user_id: userId, status: 'published' },
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar']
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取用户作品错误:', error);
        return errorResponse(res, '获取用户作品失败', 500);
    }
}

/**
 * 点赞作品
 */
async function likeWork(req, res) {
    try {
        const codemaoId = req.params.codemaoId;
        const { Like, Notification } = require('../models');
        
        const work = await DbAdapter.findOne(Work, { where: { codemao_work_id: codemaoId } });
        
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        const existingLike = await DbAdapter.findOne(Like, {
            where: { user_id: DbAdapter.getId(req.user), work_id: DbAdapter.getId(work) }
        });
        
        if (existingLike) {
            await DbAdapter.destroy(Like, { where: { id: DbAdapter.getId(existingLike) } });
            await DbAdapter.decrement(work, 'praise_times');
            const praiseTimes = (work.praise_times || 1) - 1;
            return successResponse(res, { praise_times: Math.max(0, praiseTimes), liked: false }, '已取消点赞');
        }
        
        await DbAdapter.create(Like, {
            user_id: DbAdapter.getId(req.user),
            work_id: DbAdapter.getId(work)
        });
        await DbAdapter.increment(work, 'praise_times');
        
        if (work.user_id && work.user_id.toString() !== DbAdapter.getId(req.user).toString()) {
            await DbAdapter.create(Notification, {
                user_id: work.user_id,
                type: 'like',
                title: '点赞了你的作品',
                content: work.name,
                related_id: DbAdapter.getId(work),
                related_type: 'work',
                sender_id: DbAdapter.getId(req.user)
            });
        }
        
        return successResponse(res, { praise_times: (work.praise_times || 0) + 1, liked: true }, '点赞成功');
    } catch (error) {
        console.error('点赞作品错误:', error);
        return errorResponse(res, '点赞失败', 500);
    }
}

/**
 * 删除作品
 */
async function deleteWork(req, res) {
    try {
        const codemaoId = req.params.codemaoId;
        const work = await DbAdapter.findOne(Work, { where: { codemao_work_id: codemaoId } });
        
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        if (work.user_id.toString() !== DbAdapter.getId(req.user).toString() && req.user.role !== 'admin') {
            return errorResponse(res, '无权删除此作品', 403);
        }
        
        await DbAdapter.destroy(Work, { where: { id: DbAdapter.getId(work) } });
        return successResponse(res, null, '作品已删除');
    } catch (error) {
        console.error('删除作品错误:', error);
        return errorResponse(res, '删除作品失败', 500);
    }
}

/**
 * 更新作品信息（用户只能修改自己的）
 */
async function updateWork(req, res) {
    try {
        const { codemaoId } = req.params;
        const { name, description, preview } = req.body;
        
        const work = await DbAdapter.findOne(Work, { where: { codemao_work_id: String(codemaoId) } });
        
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        if (work.user_id.toString() !== DbAdapter.getId(req.user).toString()) {
            return errorResponse(res, '无权修改此作品', 403);
        }
        
        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (preview) updateData.preview = preview;
        
        await DbAdapter.update(Work, updateData, { where: { id: DbAdapter.getId(work) } });
        
        return successResponse(res, null, '作品信息已更新');
    } catch (error) {
        console.error('更新作品错误:', error);
        return errorResponse(res, '更新失败', 500);
    }
}

module.exports = {
    publishWork,
    getWorks,
    getWorkDetail,
    getWorkByCodemaoId,
    getFeaturedWorks,
    getMyWorks,
    getUserWorks,
    likeWork,
    deleteWork,
    updateWork,
    fetchCodemaoWork
};

const DbAdapter = require('../utils/dbAdapter');
const { Studio, StudioMember, StudioWork, User, Work, Notification, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { Op } = require('sequelize');
const { isRoleAtLeast } = require('../config/permissions');
const { likeContains, escapeHtml } = require('../utils/security');
// 引入内容审核服务,落库前做敏感词/违规检查(参照 userController/postController)
const aiReview = require('../services/aiReview');

const VALID_JOIN_TYPES = ['public', 'apply', 'invite'];

function sameId(left, right) {
    return String(left) === String(right);
}

function isValidJoinType(joinType) {
    return joinType == null || VALID_JOIN_TYPES.includes(joinType);
}

async function isStudioMember(studioId, userId) {
    if (!userId) return false;

    const member = await DbAdapter.findOne(StudioMember, {
        where: { studio_id: studioId, user_id: userId, status: 'active' }
    });
    return !!member;
}

async function canViewStudio(req, studio) {
    if (!studio || studio.status !== 'active') {
        return false;
    }

    if (studio.is_public) {
        return true;
    }

    if (!req.user) {
        return false;
    }

    if (isRoleAtLeast(req.user.role, 'moderator')) {
        return true;
    }

    const userId = DbAdapter.getId(req.user);
    if (sameId(studio.owner_id, userId) || (studio.vice_owner_id && sameId(studio.vice_owner_id, userId))) {
        return true;
    }

    return isStudioMember(DbAdapter.getId(studio), userId);
}

async function createStudio(req, res) {
    try {
        let { name, description, cover, is_public, join_type } = req.body;

        // (报告1 #10) name/description 先 trim,拒绝纯空白名称(参照 userController.updateProfile)
        if (description !== undefined && description !== null) {
            description = String(description).trim();
        }
        if (name !== undefined && name !== null) {
            name = String(name).trim();
        }
        if (!String(name).trim()) {
            return errorResponse(res, '请输入工作室名称', 400);
        }

        if (!isValidJoinType(join_type)) {
            return errorResponse(res, '无效的加入方式', 400);
        }

        // (报告1 #10) 落库前对 name+description 做内容审核(参照 userController.updateProfile / postController.createPost)
        // fallbackReview 返回 recommendation: pass / review / delete
        const reviewResult = await aiReview.fallbackReview(String(name) + (description ? ' ' + String(description) : ''));
        if (reviewResult.recommendation === 'delete') {
            return errorResponse(res, `内容包含违规信息:${reviewResult.reason}`, 400);
        }
        // Studio.status 已有 'pending' 枚举,review 时设为 pending 待人工复核
        // (参照 createPost 的非阻断审核约定:Post 无 pending 故用 hidden)
        const studioStatus = reviewResult.recommendation === 'review' ? 'pending' : 'active';

        const existingOwner = await DbAdapter.findOne(Studio, { where: { owner_id: req.user.id, status: { [Op.ne]: 'banned' } } });
        if (existingOwner) {
            return errorResponse(res, '您已创建过工作室，每人只能创建一个', 400);
        }

        const existing = await DbAdapter.findOne(Studio, { where: { name } });
        if (existing) {
            return errorResponse(res, '工作室名称已存在', 400);
        }

        // (报告1 #10) 审核通过后再转义 name/description 落库(参照 userController);cover 是 URL 不转义
        const studio = await sequelize.transaction(async (t) => {
            const newStudio = await DbAdapter.create(Studio, {
                name: escapeHtml(name),
                description: description ? escapeHtml(description) : description,
                cover,
                owner_id: req.user.id,
                is_public: is_public !== false,
                join_type: join_type || 'apply',
                status: studioStatus
            }, { transaction: t });

            await DbAdapter.create(StudioMember, {
                studio_id: newStudio.id,
                user_id: req.user.id,
                role: 'owner',
                status: 'active'
            }, { transaction: t });

            return newStudio;
        });

        return successResponse(res, studio, '工作室创建成功');
    } catch (error) {
        console.error('创建工作室错误:', error);
        return errorResponse(res, '创建工作室失败', 500);
    }
}

async function getStudios(req, res) {
    try {
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);
        const keyword = req.query.keyword || '';
        
        const where = { status: 'active', is_public: true };
        if (keyword) {
            const keywordWhere = likeContains(sequelize, ['name'], keyword);
            if (keywordWhere) Object.assign(where, keywordWhere);
        }
        
        const { count, rows } = await DbAdapter.findAndCountAll(Studio, {
            where,
            include: [{
                model: User,
                as: 'owner',
                attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
            }],
            order: [['level', 'DESC'], ['points', 'DESC'], ['created_at', 'DESC']],
            limit: pageSize,
            offset
        });

        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取工作室列表错误:', error);
        return errorResponse(res, '获取工作室列表失败', 500);
    }
}

async function getStudioDetail(req, res) {
    try {
        const { id } = req.params;
        
        const studio = await DbAdapter.findByPk(Studio, id, {
            include: [{
                model: User,
                as: 'owner',
                attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
            }]
        });
        
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }

        if (studio.status !== 'active') {
            return errorResponse(res, '工作室不存在', 404);
        }

        if (!await canViewStudio(req, studio)) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        // (低) 成员按角色优先级排序:owner → vice_owner → admin → member;
        // role 为 ENUM,直接按字母序会得到 admin < member < owner < vice_owner(室长不在首位)。
        // 用 CASE 表达式自定义排序,SQLite 与 MySQL 均支持。
        // (Report4 #24) 限制单次查询返回成员数,防止大型工作室加载全量成员导致 OOM;
        //               完整成员列表应由专用接口分页获取
        const members = await DbAdapter.findAll(StudioMember, {
            where: { studio_id: id, status: 'active' },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
            }],
            order: [
                [sequelize.literal("CASE WHEN role='owner' THEN 0 WHEN role='vice_owner' THEN 1 WHEN role='admin' THEN 2 ELSE 3 END"), 'ASC'],
                ['joined_at', 'ASC']
            ],
            limit: 20
        });
        
        const works = await DbAdapter.findAll(StudioWork, {
            where: { studio_id: id, status: 'approved' },
            include: [{
                model: Work,
                as: 'work',
                where: { status: 'published' },
                required: true,
                attributes: ['id', 'name', 'preview', 'praise_times', 'view_times', 'codemao_work_id', 'ide_type', 'work_url']
            }, {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
            }],
            order: [['added_at', 'DESC']],
            limit: 12
        });
        
        let userRole = null;
        let userMemberStatus = null;
        if (req.user) {
            const member = await DbAdapter.findOne(StudioMember, {
                where: { studio_id: id, user_id: req.user.id }
            });
            if (member) {
                userRole = member.role;
                userMemberStatus = member.status;
            }
        }
        
        return successResponse(res, {
            studio,
            members: members.filter(m => m.user).map(m => ({
                ...m.user.toJSON(),
                memberRole: m.role,
                joinedAt: m.joined_at
            })),
            works: works.filter(w => w.work).map(w => ({
                ...w.work.toJSON(),
                submitUser: w.user,
                submittedAt: w.added_at
            })),
            userRole,
            userMemberStatus
        });
    } catch (error) {
        console.error('获取工作室详情错误:', error);
        return errorResponse(res, '获取工作室详情失败', 500);
    }
}

async function joinStudio(req, res) {
    try {
        const { id } = req.params;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        if (studio.status !== 'active') {
            return errorResponse(res, '该工作室已被禁用', 400);
        }

        if (!studio.is_public) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        const existing = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id }
        });
        
        if (existing) {
            if (existing.status === 'active') {
                return errorResponse(res, '您已是工作室成员', 400);
            }
            if (existing.status === 'pending') {
                return errorResponse(res, '您的申请正在审核中', 400);
            }
        }
        
        if (studio.join_type === 'invite') {
            return errorResponse(res, '该工作室仅限邀请加入', 400);
        }
        
        const status = studio.join_type === 'apply' ? 'pending' : 'active';

        let member;
        if (status === 'pending') {
            // 申请加入:不改计数,无需事务,但仍需 reload 保证返回 pending 状态而非旧 rejected(报告1 #11)
            if (existing) {
                await DbAdapter.update(StudioMember, { status }, { where: { id: DbAdapter.getId(existing) } });
                member = await existing.reload();
            } else {
                member = await DbAdapter.create(StudioMember, {
                    studio_id: id,
                    user_id: req.user.id,
                    role: 'member',
                    status
                });
            }

            try {
                await DbAdapter.create(Notification, {
                    user_id: studio.owner_id,
                    type: 'system',
                    title: '新成员申请',
                    content: `有新成员申请加入您的工作室「${studio.name}」`,
                    sender_id: req.user.id
                });
            } catch (e) { console.error('创建加入通知失败:', e.message); }
            return successResponse(res, member, '申请已提交，请等待审核');
        } else {
            // 直接加入:事务包裹 create/update 成员 + 自增 member_count,避免并发计数错乱(Report4 #12)
            // 并在事务外 reload 返回最新 pending/active 状态(报告1 #11)
            await sequelize.transaction(async (t) => {
                if (existing) {
                    await DbAdapter.update(StudioMember, { status }, { where: { id: DbAdapter.getId(existing) }, transaction: t });
                } else {
                    await DbAdapter.create(StudioMember, {
                        studio_id: id,
                        user_id: req.user.id,
                        role: 'member',
                        status
                    }, { transaction: t });
                }
                // 原子 +1 避免 read-modify-write 竞态
                await DbAdapter.increment(studio, 'member_count', { transaction: t });
            });
            await studio.reload();
            member = await DbAdapter.findOne(StudioMember, {
                where: { studio_id: id, user_id: req.user.id }
            });
            return successResponse(res, { ...(member && member.toJSON ? member.toJSON() : member), member_count: studio.member_count || 0 }, '加入成功');
        }
    } catch (error) {
        console.error('加入工作室错误:', error);
        return errorResponse(res, '加入工作室失败', 500);
    }
}

async function leaveStudio(req, res) {
    try {
        const { id } = req.params;

        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id }
        });

        if (!member) {
            return errorResponse(res, '您不是该工作室成员', 400);
        }

        if (member.role === 'owner') {
            return errorResponse(res, '创建者不能退出工作室，请转让或解散', 400);
        }

        // M2: 退出成员+计数-1+清理副室长引用需事务保证一致性
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(StudioMember, { where: { id: DbAdapter.getId(member) }, transaction: t });

            const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
            if (studio && member.status === 'active' && (studio.member_count || 0) > 0) {
                await DbAdapter.decrement(studio, 'member_count', { transaction: t });
            }
            // 如果退出者是副室长，清除引用
            if (studio && sameId(studio.vice_owner_id, req.user.id)) {
                await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: DbAdapter.getId(studio) }, transaction: t });
            }
        });

        return successResponse(res, null, '已退出工作室');
    } catch (error) {
        console.error('退出工作室错误:', error);
        return errorResponse(res, '退出工作室失败', 500);
    }
}

async function getMyStudios(req, res) {
    try {
        const memberships = await DbAdapter.findAll(StudioMember, {
            where: { user_id: req.user.id, status: 'active' },
            include: [{
                model: Studio,
                as: 'studio',
                where: { status: { [Op.ne]: 'banned' } },
                include: [{
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'username', 'nickname', 'avatar']
                }]
            }]
        });
        
        const studios = memberships.map(m => ({
            ...m.studio.toJSON(),
            memberRole: m.role
        }));
        
        return successResponse(res, studios);
    } catch (error) {
        console.error('获取我的工作室错误:', error);
        return errorResponse(res, '获取我的工作室失败', 500);
    }
}

async function updateStudio(req, res) {
    try {
        const { id } = req.params;
        let { name, description, cover, is_public, join_type } = req.body;

        // (报告1 #10) name/description 先 trim,拒绝纯空白名称(参照 userController.updateProfile)
        if (description !== undefined && description !== null) {
            description = String(description).trim();
        }
        if (name !== undefined && name !== null) {
            name = String(name).trim();
        }
        if (name !== undefined && !String(name)) {
            return errorResponse(res, '工作室名称不能为空', 400);
        }

        if (!isValidJoinType(join_type)) {
            return errorResponse(res, '无效的加入方式', 400);
        }

        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }

        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });

        if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
            return errorResponse(res, '无权修改工作室信息', 403);
        }

        // (报告1 #10) 计算最终落库的名称/描述(传入用新值,未传入用旧值),用于审核与重名校验
        const finalName = name !== undefined ? name : studio.name;
        const finalDescription = description !== undefined ? description : studio.description;

        if (String(finalName) !== String(studio.name)) {
            const existing = await DbAdapter.findOne(Studio, { where: { name: finalName } });
            if (existing) {
                return errorResponse(res, '工作室名称已存在', 400);
            }
        }

        // (报告1 #10) 当 name/description 发生变更时,对最终内容调用 aiReview.fallbackReview
        // 参照 postController.updatePost: delete → 400 拒绝;review → status='pending' 待人工复核
        let studioStatus;
        if (name !== undefined || description !== undefined) {
            const reviewResult = await aiReview.fallbackReview(String(finalName) + (finalDescription ? ' ' + String(finalDescription) : ''));
            if (reviewResult.recommendation === 'delete') {
                return errorResponse(res, `内容包含违规信息:${reviewResult.reason}`, 400);
            }
            if (reviewResult.recommendation === 'review') {
                studioStatus = 'pending';
            }
        }

        // (Bug-1) 统一使用 !== undefined 判断字段,避免 || 把空字符串当作 falsy 覆盖为旧值(参照 adminController.updateStudio)
        // (报告1 #10) 审核通过后再转义 name/description 落库(参照 userController);cover 是 URL 不转义
        const updateData = {
            name: name !== undefined ? escapeHtml(finalName) : studio.name,
            description: description !== undefined ? (finalDescription ? escapeHtml(finalDescription) : finalDescription) : studio.description,
            cover: cover !== undefined ? cover : studio.cover,
            is_public: is_public !== undefined ? is_public : studio.is_public,
            join_type: join_type !== undefined ? join_type : studio.join_type
        };
        if (studioStatus) {
            updateData.status = studioStatus;
        }

        await DbAdapter.update(Studio, updateData, { where: { id: DbAdapter.getId(studio) } });

        // 重新查询更新后的数据，避免返回旧对象
        const updatedStudio = await DbAdapter.findByPk(Studio, DbAdapter.getId(studio));
        return successResponse(res, updatedStudio, '工作室信息已更新');
    } catch (error) {
        console.error('更新工作室错误:', error);
        return errorResponse(res, '更新工作室失败', 500);
    }
}

async function reviewMember(req, res) {
    try {
        const { id, memberId } = req.params;
        const { action } = req.body;
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权审核申请', 403);
        }
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { id: memberId, studio_id: id, status: 'pending' }
        });
        
        if (!member) {
            return errorResponse(res, '申请不存在', 404);
        }

        const VALID_ACTIONS = ['approve', 'reject'];
        if (!VALID_ACTIONS.includes(action)) {
            return errorResponse(res, '无效的操作', 400);
        }

        if (action === 'approve') {
            await sequelize.transaction(async (t) => {
                await DbAdapter.update(StudioMember, { status: 'active' }, { where: { id: DbAdapter.getId(member) }, transaction: t });
                const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
                if (studio) {
                    await DbAdapter.increment(studio, 'member_count', { transaction: t });
                }
            });

            try {
                const studioForNotify = await DbAdapter.findByPk(Studio, id);
                // M6: 补全 related_id/related_type/sender_id，便于前端跳转与通知聚合
                await DbAdapter.create(Notification, {
                    user_id: member.user_id,
                    type: 'system',
                    title: '工作室申请通过',
                    content: `您申请加入的工作室「${studioForNotify?.name || '工作室'}」已通过审核`,
                    related_id: Number(id),
                    related_type: 'studio',
                    sender_id: req.user.id
                });
            } catch (notifyErr) {
                console.error('Create review notification error:', notifyErr);
            }

            return successResponse(res, null, '已通过申请');
        } else {
            await DbAdapter.update(StudioMember, { status: 'rejected' }, { where: { id: DbAdapter.getId(member) } });
            return successResponse(res, null, '已拒绝申请');
        }
    } catch (error) {
        console.error('审核成员错误:', error);
        return errorResponse(res, '审核失败', 500);
    }
}

async function deleteStudio(req, res) {
    try {
        const { id } = req.params;

        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }

        if (!sameId(studio.owner_id, req.user.id)) {
            return errorResponse(res, '只有创建者可以解散工作室', 403);
        }

        // M10: 多表关联删除必须用事务包裹，任一步失败整体回滚
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(StudioMember, { where: { studio_id: id }, transaction: t });
            await DbAdapter.destroy(StudioWork, { where: { studio_id: id }, transaction: t });
            await DbAdapter.destroy(Studio, { where: { id: DbAdapter.getId(studio) }, transaction: t });
        });

        return successResponse(res, null, '工作室已解散');
    } catch (error) {
        console.error('解散工作室错误:', error);
        return errorResponse(res, '解散工作室失败', 500);
    }
}

async function submitWork(req, res) {
    try {
        const { id } = req.params;
        const { workId } = req.body;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }

        if (studio.status !== 'active') {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!member) {
            return errorResponse(res, '您不是该工作室成员', 403);
        }
        
        let work = null;
        // (Bug-2) 优先按 codemao_work_id 查询(支持非数字字符串);未命中且 workId 为数字时再回退本地主键查询,
        // 非数字 workId 未命中 codemao_work_id 直接 404,避免 findByPk 把字符串当 PK 误判
        work = await DbAdapter.findOne(Work, { where: { codemao_work_id: String(workId) } });
        if (!work && /^\d+$/.test(String(workId))) {
            work = await DbAdapter.findByPk(Work, workId);
        }
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        if (work.status !== 'published') {
            return errorResponse(res, '作品不存在', 404);
        }

        if (!sameId(work.user_id, req.user.id)) {
            return errorResponse(res, '只能投稿自己的作品', 403);
        }
        
        const localWorkId = DbAdapter.getId(work);
        
        const existing = await DbAdapter.findOne(StudioWork, {
            where: { studio_id: id, work_id: localWorkId }
        });
        
        if (existing) {
            if (existing.status === 'approved') {
                return errorResponse(res, '该作品已在工作室中', 400);
            }
            if (existing.status === 'pending') {
                return errorResponse(res, '该作品正在审核中', 400);
            }
            // M5: 统一使用 DbAdapter.update，避免直接调用实例方法破坏适配层一致性
            await DbAdapter.update(StudioWork, { status: 'pending' }, { where: { id: DbAdapter.getId(existing) } });
            await existing.reload();
            return successResponse(res, existing, '作品已重新提交');
        }
        
        const studioWork = await DbAdapter.create(StudioWork, {
            studio_id: id,
            work_id: localWorkId,
            user_id: req.user.id,
            status: 'pending'
        });
        
        return successResponse(res, studioWork, '作品已提交，等待审核');
    } catch (error) {
        console.error('投稿作品错误:', error);
        return errorResponse(res, '投稿失败', 500);
    }
}

async function getStudioWorks(req, res) {
    try {
        const { id } = req.params;
        const { page, pageSize, offset } = DbAdapter.parsePagination(req.query);

        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio || !await canViewStudio(req, studio)) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        const where = { studio_id: id, status: 'approved' };
        
        const { count, rows } = await DbAdapter.findAndCountAll(StudioWork, {
            where,
            include: [{
                model: Work,
                as: 'work',
                where: { status: 'published' },
                required: true,
                attributes: ['id', 'name', 'preview', 'praise_times', 'view_times', 'codemao_work_id', 'ide_type', 'work_url']
            }, {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
            }],
            order: [['added_at', 'DESC']],
            limit: pageSize,
            offset
        });

        const list = rows.filter(w => w.work).map(w => ({
            ...w.work.toJSON(),
            studioWorkId: w.id,
            status: w.status,
            submitUser: w.user,
            submittedAt: w.added_at
        }));
        
        return paginateResponse(res, list, count, page, pageSize);
    } catch (error) {
        console.error('获取工作室作品错误:', error);
        return errorResponse(res, '获取作品失败', 500);
    }
}

async function reviewWork(req, res) {
    try {
        const { id, workId } = req.params;
        const { action } = req.body;
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权审核作品', 403);
        }
        
        const studioWork = await DbAdapter.findOne(StudioWork, {
            where: { id: workId, studio_id: id, status: 'pending' }
        });
        
        if (!studioWork) {
            return errorResponse(res, '作品不存在', 404);
        }

        const VALID_ACTIONS = ['approve', 'reject'];
        if (!VALID_ACTIONS.includes(action)) {
            return errorResponse(res, '无效的操作', 400);
        }

        if (action === 'approve') {
            await sequelize.transaction(async (t) => {
                await DbAdapter.update(StudioWork, { 
                    status: 'approved', 
                    reviewed_by: req.user.id,
                    reviewed_at: new Date()
                }, { where: { id: workId }, transaction: t });
                const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
                if (studio) {
                    await DbAdapter.increment(studio, 'work_count', { transaction: t });
                }
            });
            
            try {
                const studioForNotify = await DbAdapter.findByPk(Studio, id);
                // (报告1 #12) 通知 related_type 改为 'work' + related_id 用 Work 的本地主键(studioWork.work_id),
                // 与 workController/commentController 的 'work' 通知约定一致;
                // 前端 Notification.vue 按 `/${related_type}/${related_id}` 跳转,原 'studio_work' 无对应路由会误跳
                await DbAdapter.create(Notification, {
                    user_id: studioWork.user_id,
                    type: 'system',
                    title: '作品审核通过',
                    content: `您投稿到「${studioForNotify?.name || '工作室'}」的作品已通过审核`,
                    related_id: studioWork.work_id,
                    related_type: 'work',
                    sender_id: req.user.id
                });
            } catch (e) { console.error('创建审核通知失败:', e.message); }
            
            return successResponse(res, null, '作品已通过');
        } else {
            await DbAdapter.update(StudioWork, { 
                status: 'rejected',
                reviewed_by: req.user.id,
                reviewed_at: new Date()
            }, { where: { id: workId } });
            return successResponse(res, null, '作品已拒绝');
        }
    } catch (error) {
        console.error('审核作品错误:', error);
        return errorResponse(res, '审核失败', 500);
    }
}

async function removeWork(req, res) {
    try {
        const { id, workId } = req.params;
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权移除作品', 403);
        }
        
        const studioWork = await DbAdapter.findOne(StudioWork, {
            where: { id: workId, studio_id: id }
        });
        
        if (!studioWork) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        const wasApproved = studioWork.status === 'approved';
        // Bug-12: 删除 StudioWork + 调整 Studio.work_count 必须用事务保证一致性
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(StudioWork, { where: { id: DbAdapter.getId(studioWork) }, transaction: t });

            if (wasApproved) {
                const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
                if (studio && (studio.work_count || 0) > 0) {
                    await DbAdapter.decrement(studio, 'work_count', { transaction: t });
                }
            }
        });

        return successResponse(res, null, '作品已移除');
    } catch (error) {
        console.error('移除作品错误:', error);
        return errorResponse(res, '移除失败', 500);
    }
}

async function toggleWorkStatus(req, res) {
    try {
        const { id, workId } = req.params;
        const { action } = req.body;
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权操作作品', 403);
        }
        
        const studioWork = await DbAdapter.findOne(StudioWork, {
            where: { id: workId, studio_id: id }
        });
        
        if (!studioWork) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        if (action === 'down') {
            // M19: 只允许下架已通过审核的作品，防止 pending/rejected 状态被误改写为 down
            if (studioWork.status !== 'approved') {
                return errorResponse(res, '当前状态不允许下架', 400);
            }
            // Bug-12: 更新 StudioWork 状态 + 调整 Studio.work_count 必须用事务保证一致性
            await sequelize.transaction(async (t) => {
                await DbAdapter.update(StudioWork, { status: 'down' }, { where: { id: workId }, transaction: t });
                const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
                if (studio && (studio.work_count || 0) > 0) {
                    await DbAdapter.decrement(studio, 'work_count', { transaction: t });
                }
            });
            return successResponse(res, null, '作品已下架');
        } else if (action === 'up') {
            // 仅允许已下架(down)的作品重新上架，防止 pending/rejected 绕过审核
            if (studioWork.status !== 'down') {
                return errorResponse(res, '当前状态不允许上架', 400);
            }
            // Bug-12: 更新 StudioWork 状态 + 调整 Studio.work_count 必须用事务保证一致性
            await sequelize.transaction(async (t) => {
                await DbAdapter.update(StudioWork, { status: 'approved' }, { where: { id: workId }, transaction: t });
                const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
                if (studio) {
                    await DbAdapter.increment(studio, 'work_count', { transaction: t });
                }
            });
            return successResponse(res, null, '作品已上架');
        }
        
        return errorResponse(res, '无效操作', 400);
    } catch (error) {
        console.error('切换作品状态错误:', error);
        return errorResponse(res, '操作失败', 500);
    }
}

async function getPendingMembers(req, res) {
    try {
        const { id } = req.params;
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权查看', 403);
        }
        
        const members = await DbAdapter.findAll(StudioMember, {
            where: { studio_id: id, status: 'pending' },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }],
            order: [['joined_at', 'ASC']]
        });
        
        return successResponse(res, members);
    } catch (error) {
        console.error('获取待审核成员错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

async function getPendingWorks(req, res) {
    try {
        const { id } = req.params;
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权查看', 403);
        }
        
        const works = await DbAdapter.findAll(StudioWork, {
            where: { studio_id: id, status: 'pending' },
            include: [{
                model: Work,
                as: 'work',
                attributes: ['id', 'name', 'preview', 'praise_times', 'view_times', 'codemao_work_id']
            }, {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar']
            }],
            order: [['added_at', 'ASC']]
        });
        
        return successResponse(res, works);
    } catch (error) {
        console.error('获取待审核作品错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

async function setMemberRole(req, res) {
    try {
        const { id, memberId } = req.params;
        const { role } = req.body;
        
        const ownerMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, role: 'owner' }
        });
        
        if (!ownerMember) {
            return errorResponse(res, '只有创建者可以设置成员角色', 403);
        }
        
        if (!['admin', 'member', 'vice_owner'].includes(role)) {
            return errorResponse(res, '无效的角色', 400);
        }
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { id: memberId, studio_id: id, status: 'active' }
        });
        
        if (!member) {
            return errorResponse(res, '成员不存在', 404);
        }
        
        if (member.role === 'owner') {
            return errorResponse(res, '不能修改创建者角色', 400);
        }
        
        // 如果被修改的成员是副室长且角色降级，清除副室长引用
        const studio = await DbAdapter.findByPk(Studio, id);
        if (member.role === 'vice_owner' && role !== 'vice_owner') {
            if (studio && sameId(studio.vice_owner_id, member.user_id)) {
                await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: DbAdapter.getId(studio) } });
            }
        }
        // 如果提升为副室长，同步 studio.vice_owner_id（清除旧副室长）
        if (role === 'vice_owner') {
            await sequelize.transaction(async (t) => {
                if (studio && studio.vice_owner_id) {
                    await DbAdapter.update(StudioMember,
                        { role: 'member' },
                        { where: { studio_id: id, user_id: studio.vice_owner_id }, transaction: t }
                    );
                }
                await DbAdapter.update(Studio,
                    { vice_owner_id: member.user_id },
                    { where: { id: DbAdapter.getId(studio) }, transaction: t }
                );
            });
        }

        await DbAdapter.update(StudioMember, { role }, { where: { id: DbAdapter.getId(member) } });
        return successResponse(res, null, '角色已更新');
    } catch (error) {
        console.error('设置成员角色错误:', error);
        return errorResponse(res, '设置失败', 500);
    }
}

async function kickMember(req, res) {
    try {
        const { id, memberId } = req.params;
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权移除成员', 403);
        }
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { id: memberId, studio_id: id, status: 'active' }
        });
        
        if (!member) {
            return errorResponse(res, '成员不存在', 404);
        }
        
        if (member.role === 'owner') {
            return errorResponse(res, '不能移除创建者', 400);
        }
        
        if (member.role === 'admin' && adminMember.role !== 'owner') {
            return errorResponse(res, '无权移除管理员', 403);
        }

        // M2: 踢出成员+计数-1+清理副室长引用需事务保证一致性
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(StudioMember, { where: { id: DbAdapter.getId(member) }, transaction: t });
            const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
            if (studio && (studio.member_count || 0) > 0) {
                await DbAdapter.decrement(studio, 'member_count', { transaction: t });
            }
            // 如果被移除者是副室长，清除引用
            if (studio && sameId(studio.vice_owner_id, member.user_id)) {
                await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: DbAdapter.getId(studio) }, transaction: t });
            }
        });

        return successResponse(res, null, '成员已移除');
    } catch (error) {
        console.error('移除成员错误:', error);
        return errorResponse(res, '移除失败', 500);
    }
}

async function setViceOwner(req, res) {
    try {
        const { id } = req.params;
        const { user_id } = req.body;

        // 防止室长将自己设为副室长，否则其 role 会被改为 vice_owner 导致永久失去管理权
        if (String(user_id) === String(req.user.id)) {
            return errorResponse(res, '不能将自己设为副室长', 400);
        }

        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!member || member.role !== 'owner') {
            return errorResponse(res, '只有室长可以设置副室长', 403);
        }
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }

        if (user_id) {
            const viceMember = await DbAdapter.findOne(StudioMember, {
                where: { studio_id: id, user_id: user_id, status: 'active' }
            });
            
            if (!viceMember) {
                return errorResponse(res, '该用户不是工作室成员', 400);
            }
            
            await sequelize.transaction(async (t) => {
                // 清除旧副室长角色
                if (studio.vice_owner_id) {
                    await DbAdapter.update(StudioMember,
                        { role: 'member' },
                        { where: { studio_id: id, user_id: studio.vice_owner_id }, transaction: t }
                    );
                }
                // 设置新副室长
                await DbAdapter.update(Studio,
                    { vice_owner_id: user_id },
                    { where: { id: DbAdapter.getId(studio) }, transaction: t }
                );
                await DbAdapter.update(StudioMember,
                    { role: 'vice_owner' },
                    { where: { id: DbAdapter.getId(viceMember) }, transaction: t }
                );
            });
        } else {
            // 取消副室长
            if (studio.vice_owner_id) {
                await sequelize.transaction(async (t) => {
                    await DbAdapter.update(StudioMember,
                        { role: 'member' },
                        { where: { studio_id: id, user_id: studio.vice_owner_id }, transaction: t }
                    );
                    await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: DbAdapter.getId(studio) }, transaction: t });
                });
            }
        }

        const updatedStudio = await DbAdapter.findByPk(Studio, DbAdapter.getId(studio));
        return successResponse(res, updatedStudio, '副室长已设置');
    } catch (error) {
        console.error('设置副室长错误:', error);
        return errorResponse(res, '设置失败', 500);
    }
}

async function dissolveStudio(req, res) {
    try {
        const { id } = req.params;

        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });

        if (!member || member.role !== 'owner') {
            return errorResponse(res, '只有室长可以解散工作室', 403);
        }

        // M10: 多表关联删除必须用事务包裹，任一步失败整体回滚
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(StudioMember, { where: { studio_id: id }, transaction: t });
            await DbAdapter.destroy(StudioWork, { where: { studio_id: id }, transaction: t });
            await DbAdapter.destroy(Studio, { where: { id }, transaction: t });
        });

        return successResponse(res, null, '工作室已解散');
    } catch (error) {
        console.error('解散工作室错误:', error);
        return errorResponse(res, '解散失败', 500);
    }
}

module.exports = {
    createStudio,
    getStudios,
    getStudioDetail,
    joinStudio,
    leaveStudio,
    getMyStudios,
    updateStudio,
    reviewMember,
    deleteStudio,
    submitWork,
    getStudioWorks,
    reviewWork,
    removeWork,
    toggleWorkStatus,
    getPendingMembers,
    getPendingWorks,
    setMemberRole,
    kickMember,
    setViceOwner,
    dissolveStudio
};

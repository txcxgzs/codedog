const DbAdapter = require('../utils/dbAdapter');
const { Studio, StudioMember, StudioWork, User, Work, Notification, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { Op } = require('sequelize');

async function createStudio(req, res) {
    try {
        const { name, description, cover, is_public, join_type } = req.body;
        
        if (!name) {
            return errorResponse(res, '请输入工作室名称', 400);
        }
        
        const existingOwner = await DbAdapter.findOne(Studio, { where: { owner_id: req.user.id, status: { [Op.ne]: 'banned' } } });
        if (existingOwner) {
            return errorResponse(res, '您已创建过工作室，每人只能创建一个', 400);
        }
        
        const existing = await DbAdapter.findOne(Studio, { where: { name } });
        if (existing) {
            return errorResponse(res, '工作室名称已存在', 400);
        }
        
        const studio = await DbAdapter.create(Studio, {
            name,
            description,
            cover,
            owner_id: req.user.id,
            is_public: is_public !== false,
            join_type: join_type || 'apply'
        });
        
        await DbAdapter.create(StudioMember, {
            studio_id: studio.id,
            user_id: req.user.id,
            role: 'owner',
            status: 'active'
        });
        
        return successResponse(res, studio, '工作室创建成功');
    } catch (error) {
        console.error('创建工作室错误:', error);
        return errorResponse(res, '创建工作室失败', 500);
    }
}

async function getStudios(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const keyword = req.query.keyword || '';
        
        const where = { status: 'active' };
        if (keyword) {
            where.name = { [Op.like]: `%${keyword}%` };
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
            offset: (page - 1) * pageSize
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
        
        const members = await DbAdapter.findAll(StudioMember, {
            where: { studio_id: id, status: 'active' },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
            }],
            order: [['role', 'ASC'], ['joined_at', 'ASC']]
        });
        
        const works = await DbAdapter.findAll(StudioWork, {
            where: { studio_id: id, status: 'approved' },
            include: [{
                model: Work,
                as: 'work',
                attributes: ['id', 'name', 'preview', 'praise_times', 'view_times', 'codemao_work_id', 'ide_type', 'work_url']
            }, {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
            }],
            order: [['created_at', 'DESC']],
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
            members: members.map(m => ({
                ...m.user.toJSON(),
                memberRole: m.role,
                joinedAt: m.joined_at
            })),
            works: works.map(w => ({
                ...w.work.toJSON(),
                submitUser: w.user,
                submittedAt: w.created_at
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
        if (existing) {
            await DbAdapter.update(StudioMember, { status }, { where: { id: DbAdapter.getId(existing) } });
            member = existing;
        } else {
            member = await DbAdapter.create(StudioMember, {
                studio_id: id,
                user_id: req.user.id,
                role: 'member',
                status
            });
        }
        
        if (status === 'pending') {
            await DbAdapter.create(Notification, {
                user_id: studio.owner_id,
                type: 'system',
                title: '新成员申请',
                content: `有新成员申请加入您的工作室「${studio.name}」`,
                sender_id: req.user.id
            });
            return successResponse(res, member, '申请已提交，请等待审核');
        } else {
            await DbAdapter.increment(studio, 'member_count');
            return successResponse(res, member, '加入成功');
        }
    } catch (error) {
        console.error('加入工作室错误:', error);
        return errorResponse(res, '加入工作室失败', 500);
    }
}

async function leaveStudio(req, res) {
    try {
        const { id } = req.params;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id }
        });
        
        if (!member) {
            return errorResponse(res, '您不是该工作室成员', 400);
        }
        
        if (member.role === 'owner') {
            return errorResponse(res, '创建者不能退出工作室，请转让或解散', 400);
        }
        
        await DbAdapter.destroy(StudioMember, { where: { id: DbAdapter.getId(member) } });

        await DbAdapter.decrement(studio, 'member_count');

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
        const { name, description, cover, is_public, join_type } = req.body;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id }
        });
        
        if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
            return errorResponse(res, '无权修改工作室信息', 403);
        }
        
        if (name && name !== studio.name) {
            const existing = await DbAdapter.findOne(Studio, { where: { name } });
            if (existing) {
                return errorResponse(res, '工作室名称已存在', 400);
            }
        }
        
        await DbAdapter.update(Studio, {
            name: name || studio.name,
            description: description !== undefined ? description : studio.description,
            cover: cover || studio.cover,
            is_public: is_public !== undefined ? is_public : studio.is_public,
            join_type: join_type || studio.join_type
        }, { where: { id: DbAdapter.getId(studio) } });
        
        return successResponse(res, studio, '工作室信息已更新');
    } catch (error) {
        console.error('更新工作室错误:', error);
        return errorResponse(res, '更新工作室失败', 500);
    }
}

async function reviewMember(req, res) {
    try {
        const { id, memberId } = req.params;
        const { action } = req.body;
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id }
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
        
        if (action === 'approve') {
            await DbAdapter.update(StudioMember, { status: 'active' }, { where: { id: DbAdapter.getId(member) } });

            await DbAdapter.increment(studio, 'member_count');

            await DbAdapter.create(Notification, {
                user_id: member.user_id,
                type: 'system',
                title: '工作室申请通过',
                content: `您申请加入的工作室「${studio.name}」已通过审核`,
                sender_id: studio.owner_id
            });

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
        
        if (studio.owner_id !== req.user.id) {
            return errorResponse(res, '只有创建者可以解散工作室', 403);
        }
        
        await DbAdapter.destroy(StudioMember, { where: { studio_id: id } });
        await DbAdapter.destroy(StudioWork, { where: { studio_id: id } });
        await DbAdapter.destroy(Studio, { where: { id: DbAdapter.getId(studio) } });
        
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
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!member) {
            return errorResponse(res, '您不是该工作室成员', 403);
        }
        
        const work = await DbAdapter.findByPk(Work, workId);
        if (!work) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        if (work.user_id !== req.user.id) {
            return errorResponse(res, '只能投稿自己的作品', 403);
        }
        
        const existing = await DbAdapter.findOne(StudioWork, {
            where: { studio_id: id, work_id: workId }
        });
        
        if (existing) {
            if (existing.status === 'approved') {
                return errorResponse(res, '该作品已在工作室中', 400);
            }
            if (existing.status === 'pending') {
                return errorResponse(res, '该作品正在审核中', 400);
            }
            await existing.update({ status: 'pending' });
            return successResponse(res, existing, '作品已重新提交');
        }
        
        const studioWork = await DbAdapter.create(StudioWork, {
            studio_id: id,
            work_id: workId,
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
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status;
        
        const where = { studio_id: id, status: 'approved' };
        if (status) where.status = status;
        
        const { count, rows } = await DbAdapter.findAndCountAll(StudioWork, {
            where,
            include: [{
                model: Work,
                as: 'work',
                attributes: ['id', 'name', 'preview', 'praise_times', 'view_times', 'codemao_work_id', 'ide_type', 'work_url']
            }, {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
            }],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });
        
        const list = rows.filter(w => w.work).map(w => ({
            ...w.work.toJSON(),
            studioWorkId: w.id,
            status: w.status,
            submitUser: w.user,
            submittedAt: w.created_at
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
            where: { studio_id: id, user_id: req.user.id }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权审核作品', 403);
        }
        
        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }
        
        const studioWork = await DbAdapter.findOne(StudioWork, {
            where: { id: workId, studio_id: id, status: 'pending' }
        });
        
        if (!studioWork) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        if (action === 'approve') {
            await DbAdapter.update(StudioWork, {
                status: 'approved',
                reviewed_by: req.user.id,
                reviewed_at: new Date()
            }, { where: { id: workId } });

            await DbAdapter.increment(studio, 'work_count');

            await DbAdapter.create(Notification, {
                user_id: studioWork.user_id,
                type: 'system',
                title: '作品审核通过',
                content: `您投稿到「${studio.name}」的作品已通过审核`,
                sender_id: studio.owner_id
            });

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
            where: { studio_id: id, user_id: req.user.id }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权移除作品', 403);
        }
        
        const studioWork = await DbAdapter.findOne(StudioWork, {
            where: { id: workId, studio_id: id },
            include: [{ model: Studio, as: 'studio', attributes: ['id', 'work_count'] }]
        });

        if (!studioWork) {
            return errorResponse(res, '作品不存在', 404);
        }

        const wasApproved = studioWork.status === 'approved';
        await DbAdapter.destroy(StudioWork, { where: { id: DbAdapter.getId(studioWork) } });

        if (wasApproved) {
            await DbAdapter.decrement(studioWork.studio, 'work_count');
        }

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
            where: { studio_id: id, user_id: req.user.id }
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
            await DbAdapter.update(StudioWork, { status: 'down' }, { where: { id: workId } });
            return successResponse(res, null, '作品已下架');
        } else if (action === 'up') {
            await DbAdapter.update(StudioWork, { status: 'approved' }, { where: { id: workId } });
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
            where: { studio_id: id, user_id: req.user.id }
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
            where: { studio_id: id, user_id: req.user.id }
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
            order: [['created_at', 'ASC']]
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
        
        if (!['admin', 'member'].includes(role)) {
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
            where: { studio_id: id, user_id: req.user.id }
        });
        
        if (!adminMember || (adminMember.role !== 'owner' && adminMember.role !== 'admin')) {
            return errorResponse(res, '无权移除成员', 403);
        }

        const member = await DbAdapter.findOne(StudioMember, {
            where: { id: memberId, studio_id: id, status: 'active' },
            attributes: ['id', 'studio_id', 'user_id', 'role', 'status'],
            include: [{ model: Studio, as: 'studio', attributes: ['id', 'member_count'] }]
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

        await DbAdapter.destroy(StudioMember, { where: { id: DbAdapter.getId(member) } });
        await DbAdapter.decrement(member.studio, 'member_count');

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
        
        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: req.user.id, status: 'active' }
        });
        
        if (!member || member.role !== 'owner') {
            return errorResponse(res, '只有室长可以设置副市长', 403);
        }
        
        const studio = await DbAdapter.findByPk(Studio, id);
        
        if (user_id) {
            const viceMember = await DbAdapter.findOne(StudioMember, {
                where: { studio_id: id, user_id: user_id, status: 'active' }
            });
            
            if (!viceMember) {
                return errorResponse(res, '该用户不是工作室成员', 400);
            }
            
            await DbAdapter.update(Studio, { vice_owner_id: user_id }, { where: { id: DbAdapter.getId(studio) } });
        } else {
            await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: DbAdapter.getId(studio) } });
        }
        
        return successResponse(res, studio, '副市长已设置');
    } catch (error) {
        console.error('设置副市长错误:', error);
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
        
        await DbAdapter.destroy(StudioMember, { where: { studio_id: id } });
        await DbAdapter.destroy(StudioWork, { where: { studio_id: id } });
        await DbAdapter.destroy(Studio, { where: { id } });
        
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

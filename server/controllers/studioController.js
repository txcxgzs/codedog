const DbAdapter = require('../utils/dbAdapter');
const { Studio, StudioMember, StudioWork, User, Work, Notification, sequelize } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');
const { Op } = require('sequelize');
const { isRoleAtLeast } = require('../config/permissions');
const { likeContains } = require('../utils/security');
// 引入内容审核服务,落库前做敏感词/违规检查(参照 userController/postController)
const aiReview = require('../services/aiReview');
const { generateAndUploadStudioCover } = require('../services/studioCover');

const VALID_JOIN_TYPES = ['public', 'apply', 'invite'];

function sameId(left, right) {
    return String(left) === String(right);
}

// 判断角色是否具有工作室管理权限(owner > vice_owner > admin)
// 用于统一管理操作的鉴权条件,避免遗漏 vice_owner
function isStudioManagerRole(role) {
    return role === 'owner' || role === 'vice_owner' || role === 'admin';
}

// 统一重算工作室 work_count 和 total_score(仅统计 approved 作品)
// 修复: 之前 reviewWork/toggleWorkStatus/removeWork/leaveStudio 只更新 work_count
// 不更新 total_score,导致工作室总分在上下架/移除/退出后漂移
async function recalculateStudioStats(studioId, transaction) {
    const [workCount, totalScore] = await Promise.all([
        DbAdapter.count(StudioWork, { where: { studio_id: studioId, status: 'approved' }, transaction }),
        DbAdapter.sum(StudioWork, 'score', { where: { studio_id: studioId, status: 'approved' }, transaction })
    ]);
    await DbAdapter.update(Studio, { work_count: workCount, total_score: totalScore || 0 }, { where: { id: studioId }, transaction });
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

// A user may belong to (or have a pending application for) only one studio.
// Keep this check on the server so the rule cannot be bypassed by calling the
// join endpoint directly.
async function findOtherStudioMembership(userId, studioId = null, transaction = null) {
    const where = {
        user_id: userId,
        status: { [Op.in]: ['active', 'pending'] }
    };
    if (studioId !== null && studioId !== undefined) {
        where.studio_id = { [Op.ne]: studioId };
    }
    const options = { where };
    if (transaction) options.transaction = transaction;
    return DbAdapter.findOne(StudioMember, options);
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
        if (!name || !String(name).trim()) {
            return errorResponse(res, '请输入工作室名称', 400);
        }
        if (description !== undefined && description !== null) {
            description = String(description).trim();
        }
        if (name !== undefined && name !== null) {
            name = String(name).trim();
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

        // 修复: 将"一人只能创建一个工作室"和"名称查重"检查移入事务内
        // 原先检查在事务外,并发请求可同时通过检查后各自创建,导致同一用户拥有多个工作室
        const studio = await sequelize.transaction(async (t) => {
            const existingMembership = await findOtherStudioMembership(DbAdapter.getId(req.user), null, t);
            if (existingMembership) {
                const err = new Error('您已加入或正在申请其他工作室，每人只能属于一个工作室');
                err.statusCode = 400;
                throw err;
            }

            // 事务内重新检查 owner 唯一性,防止并发绕过
            const existingOwner = await DbAdapter.findOne(Studio, {
                where: { owner_id: DbAdapter.getId(req.user), status: { [Op.ne]: 'banned' } },
                transaction: t
            });
            if (existingOwner) {
                const err = new Error('您已创建过工作室，每人只能创建一个');
                err.statusCode = 400;
                throw err;
            }

            // 事务内重新检查名称唯一性
            const existing = await DbAdapter.findOne(Studio, { where: { name }, transaction: t });
            if (existing) {
                const err = new Error('工作室名称已存在');
                err.statusCode = 400;
                throw err;
            }

            const newStudio = await DbAdapter.create(Studio, {
                name: name,
                description: description || null,
                cover,
                owner_id: DbAdapter.getId(req.user),
                is_public: is_public !== false,
                join_type: join_type || 'apply',
                status: studioStatus,
                // 修复: 设置 owner_claim 实现数据库级唯一约束
                // 当 status != 'banned' 时 owner_claim = owner_id,唯一索引阻止并发创建
                owner_claim: DbAdapter.getId(req.user)
            }, { transaction: t });

            // Bug-17: 审核结果为 review 时创建 pending 工作室,owner 成员也应为 pending,
            // 避免工作室 pending 但成员 active 的状态语义混乱
            await DbAdapter.create(StudioMember, {
                studio_id: newStudio.id,
                user_id: DbAdapter.getId(req.user),
                role: 'owner',
                status: studioStatus === 'pending' ? 'pending' : 'active'
            }, { transaction: t });

            return newStudio;
        });

        if (!studio.cover) {
            try {
                const url = await generateAndUploadStudioCover(studio);
                await DbAdapter.update(Studio, { cover: url, cover_url: url }, { where: { id: studio.id } });
                studio.cover = url;
                studio.cover_url = url;
            } catch (coverError) {
                console.error('[studio-cover] 新工作室默认封面生成失败:', coverError.message);
            }
        }

        // Bug-17: pending 状态的工作室返回不同提示
        const msg = studioStatus === 'pending' ? '工作室已创建，正在审核中' : '工作室创建成功';
        return successResponse(res, studio, msg);
    } catch (error) {
        // 事务内抛出的业务状态错误应返回 400,避免全部吞成 500
        if (error.statusCode === 400) {
            return errorResponse(res, error.message, 400);
        }
        // 修复: 捕获 owner_claim 唯一约束错误,返回友好提示
        if (error.name === 'SequelizeUniqueConstraintError') {
            return errorResponse(res, '您已创建过工作室，每人只能创建一个', 400);
        }
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

        // 旧工作室首次读取时补齐持久化默认封面，以后列表和详情始终使用同一图床地址。
        await Promise.all(rows.filter(studio => !studio.cover && !studio.cover_url).map(async (studio) => {
            try {
                const url = await generateAndUploadStudioCover(studio);
                await DbAdapter.update(Studio, { cover: url, cover_url: url }, { where: { id: studio.id } });
                studio.cover = url;
                studio.cover_url = url;
            } catch (error) {
                console.error(`[studio-cover] 工作室 ${studio.id} 默认封面生成失败:`, error.message);
            }
        }));

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

        if (!studio.cover && !studio.cover_url) {
            try {
                const url = await generateAndUploadStudioCover(studio);
                await DbAdapter.update(Studio, { cover: url, cover_url: url }, { where: { id: studio.id } });
                studio.cover = url;
                studio.cover_url = url;
            } catch (error) {
                console.error(`[studio-cover] 工作室 ${studio.id} 详情封面生成失败:`, error.message);
            }
        }
        
        // (低) 成员按角色优先级排序:owner → vice_owner → admin → member;
        // role 为 ENUM,直接按字母序会得到 admin < member < owner < vice_owner(室长不在首位)。
        // 用 CASE 表达式自定义排序,SQLite 与 MySQL 均支持。
        // (Report4 #24) 限制单次查询返回成员数,防止大型工作室加载全量成员导致 OOM;
        //               完整成员列表应由专用接口分页获取。
        //               返回 totalMemberCount/hasMoreMembers 告知前端是否需要加载更多。
        // 修复: 加 try/catch 防御 CASE 表达式在某些 SQLite 版本或异常数据下失败
        const memberWhere = { studio_id: id, status: 'active' };
        let memberResult = [];
        let totalMemberCount = 0;
        try {
            const [mResult, mCount] = await Promise.all([
                DbAdapter.findAll(StudioMember, {
                    where: memberWhere,
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
                }),
                DbAdapter.count(StudioMember, { where: memberWhere })
            ]);
            memberResult = mResult;
            totalMemberCount = mCount;
        } catch (memberError) {
            console.error('[getStudioDetail] 成员查询失败,降级为不排序:', memberError.message);
            // 降级:去掉 CASE 排序,避免整个接口 500
            try {
                const [mResult, mCount] = await Promise.all([
                    DbAdapter.findAll(StudioMember, {
                        where: memberWhere,
                        include: [{
                            model: User,
                            as: 'user',
                            attributes: ['id', 'username', 'nickname', 'avatar', 'codemao_user_id']
                        }],
                        order: [['joined_at', 'ASC']],
                        limit: 20
                    }),
                    DbAdapter.count(StudioMember, { where: memberWhere })
                ]);
                memberResult = mResult;
                totalMemberCount = mCount;
            } catch (fallbackError) {
                console.error('[getStudioDetail] 成员查询降级也失败:', fallbackError.message);
                // 最终降级:返回空成员列表
            }
        }
        const members = memberResult;
        
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
        let joinBlockedReason = null;
        if (req.user) {
            const userId = DbAdapter.getId(req.user);
            const member = await DbAdapter.findOne(StudioMember, {
                where: { studio_id: id, user_id: userId }
            });
            if (member) {
                userRole = member.role;
                userMemberStatus = member.status;
            } else if (await findOtherStudioMembership(userId, id)) {
                joinBlockedReason = '您已加入或正在申请其他工作室，每人只能属于一个工作室';
            }
        }
        
        return successResponse(res, {
            studio,
            members: members.filter(m => m.user).map(m => ({
                id: m.id,
                user_id: m.user_id,
                memberRole: m.role,
                joinedAt: m.joined_at,
                user: m.user.toJSON(),
                nickname: m.user.nickname,
                username: m.user.username,
                avatar: m.user.avatar
            })),
            totalMemberCount,
            hasMoreMembers: totalMemberCount > 20,
            works: works.filter(w => w.work).map(w => ({
                ...w.work.toJSON(),
                submitUser: w.user,
                submittedAt: w.added_at
            })),
            userRole,
            userMemberStatus,
            joinBlockedReason
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user) }
        });
        
        if (existing) {
            if (existing.status === 'active') {
                return errorResponse(res, '您已是工作室成员', 400);
            }
            if (existing.status === 'pending') {
                return errorResponse(res, '您的申请正在审核中', 400);
            }
        }

        const otherMembership = await findOtherStudioMembership(DbAdapter.getId(req.user), id);
        if (otherMembership) {
            return errorResponse(res, '您已加入或正在申请其他工作室，每人只能属于一个工作室', 400);
        }
        
        if (studio.join_type === 'invite') {
            return errorResponse(res, '该工作室仅限邀请加入', 400);
        }
        
        const status = studio.join_type === 'apply' ? 'pending' : 'active';

        let member;
        if (status === 'pending') {
            // Bug-11: 申请加入也用事务包裹 create/update 成员,避免并发退群重申导致状态覆盖错乱
            await sequelize.transaction(async (t) => {
                if (existing) {
                    await DbAdapter.update(StudioMember, { status }, { where: { id: DbAdapter.getId(existing) }, transaction: t });
                } else {
                    await DbAdapter.create(StudioMember, {
                        studio_id: id,
                        user_id: DbAdapter.getId(req.user),
                        role: 'member',
                        status
                    }, { transaction: t });
                }
            });
            member = await DbAdapter.findOne(StudioMember, {
                where: { studio_id: id, user_id: DbAdapter.getId(req.user) }
            });

            try {
                await DbAdapter.create(Notification, {
                    user_id: studio.owner_id,
                    type: 'system',
                    title: '新成员申请',
                    content: `有新成员申请加入您的工作室「${studio.name}」`,
                    sender_id: DbAdapter.getId(req.user)
                });
            } catch (e) { console.error('创建加入通知失败:', e.message); }
            return successResponse(res, member, '申请已提交，请等待审核');
        } else {
            // 直接加入:事务包裹 create/update 成员 + 自增 member_count,避免并发计数错乱(Report4 #12)
            // 并在事务外 reload 返回最新 pending/active 状态(报告1 #11)
            await sequelize.transaction(async (t) => {
                let shouldIncrement = false;
                if (existing) {
                    // 修复: 仅当 status='rejected' 时才更新为 active 并计数
                    // 防止并发请求同时将同一条 rejected 记录改为 active,导致 member_count 重复+1
                    const [affectedRows] = await StudioMember.update(
                        { status },
                        { where: { id: DbAdapter.getId(existing), status: 'rejected' }, transaction: t }
                    );
                    shouldIncrement = affectedRows === 1;
                } else {
                    // 新成员:用 create + 捕获唯一约束错误防止并发重复创建
                    try {
                        await DbAdapter.create(StudioMember, {
                            studio_id: id,
                            user_id: DbAdapter.getId(req.user),
                            role: 'member',
                            status
                        }, { transaction: t });
                        shouldIncrement = true;
                    } catch (e) {
                        // 并发时唯一约束可能触发(如果有),此时不计数
                        if (e.name === 'SequelizeUniqueConstraintError') {
                            return successResponse(res, null, '您已是工作室成员');
                        }
                        throw e;
                    }
                }
                // 仅在确实新增了 active 成员时才 +1
                if (shouldIncrement) {
                    await DbAdapter.increment(studio, 'member_count', { transaction: t });
                }
            });
            await studio.reload();
            member = await DbAdapter.findOne(StudioMember, {
                where: { studio_id: id, user_id: DbAdapter.getId(req.user) }
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user) }
        });

        if (!member) {
            return errorResponse(res, '您不是该工作室成员', 400);
        }

        if (member.role === 'owner') {
            return errorResponse(res, '创建者不能退出工作室，请转让或解散', 400);
        }

        // M2/Bug-19: 退出成员+计数-1+清理副室长引用需事务保证一致性
        // 原子递减用模型级 where member_count>0 避免漂移(不再用旧实例 member_count 判断)
        // Bug-3(打工机器): 同时清理该用户在该工作室的 StudioWork 记录
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(StudioMember, { where: { id: DbAdapter.getId(member) }, transaction: t });
            const removedStudioWorks = await DbAdapter.findAll(StudioWork, {
                where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'approved' },
                attributes: ['id'],
                transaction: t
            });
            await DbAdapter.destroy(StudioWork, { where: { studio_id: id, user_id: DbAdapter.getId(req.user) }, transaction: t });

            if (member.status === 'active') {
                await DbAdapter.decrement(Studio, 'member_count', {
                    where: { id: id, member_count: { [Op.gt]: 0 } },
                    transaction: t
                });
            }
            // 如果退出者是副室长，清除引用
            const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
            if (studio && sameId(studio.vice_owner_id, DbAdapter.getId(req.user))) {
                await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: id }, transaction: t });
            }
            // 如果有已通过审核的作品被移除,重算工作室 work_count 和 total_score
            // 修复: 原先只重算 work_count 不重算 total_score,导致退出成员的已评分作品分数仍被计入
            if (removedStudioWorks.length > 0) {
                await recalculateStudioStats(id, t);
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
            where: { user_id: DbAdapter.getId(req.user), status: { [Op.in]: ['active', 'pending'] } },
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

        // name 传入 null 时也应拒绝,防止 String(null)='null' 绕过空校验落脏数据
        if (name !== undefined && (name === null || String(name).trim() === '')) {
            return errorResponse(res, '工作室名称不能为空', 400);
        }
        // name 有值时 trim,未传则保留 undefined
        if (name !== undefined && name !== null) {
            name = String(name).trim();
        }

        if (description !== undefined && description !== null) {
            description = String(description).trim();
        }

        if (!isValidJoinType(join_type)) {
            return errorResponse(res, '无效的加入方式', 400);
        }

        const studio = await DbAdapter.findByPk(Studio, id);
        if (!studio) {
            return errorResponse(res, '工作室不存在', 404);
        }

        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
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

        // (Bug-1) 统一使用 !== undefined 判断字段,避免 || 把空字符串当作 falsy 覆盖为旧值
        // 修复: 存原始 name/description(不转义),渲染时才转义,避免查重失效和二次转义
        const updateData = {
            name: name !== undefined ? finalName : studio.name,
            description: description !== undefined ? (finalDescription || null) : studio.description,
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });
        
        if (!adminMember || !isStudioManagerRole(adminMember.role)) {
            return errorResponse(res, '无权审核申请', 403);
        }
        
        // 🔴4 修复: pending 检查从事务外移入事务内,使用 SELECT ... WHERE status='pending' 防幻读
        // 并发狂点时多个请求都看到 pending,然后全部挤进事务导致 member_count 双增
        const VALID_ACTIONS = ['approve', 'reject'];
        if (!VALID_ACTIONS.includes(action)) {
            return errorResponse(res, '无效的操作', 400);
        }

        // 🔴4 修复: 先查 member 用于权限结束后获取 user_id 发通知
        let member = await DbAdapter.findOne(StudioMember, {
            where: { id: memberId, studio_id: id }
        });
        if (!member) {
            return errorResponse(res, '申请不存在', 404);
        }

        if (action === 'approve') {
            let approved = false;
            await sequelize.transaction(async (t) => {
                // 在事务内用 WHERE status='pending' 原子更新,确保只处理一次
                const affectedRows = await DbAdapter.update(StudioMember,
                    { status: 'active' },
                    { where: { id: memberId, studio_id: id, status: 'pending' }, transaction: t }
                );
                const count = Array.isArray(affectedRows) ? affectedRows[0] : affectedRows;
                if (count > 0) {
                    approved = true;
                    const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
                    if (studio) {
                        await DbAdapter.increment(studio, 'member_count', { transaction: t });
                    }
                }
            });
            if (!approved) {
                return errorResponse(res, '申请已处理或不存在', 400);
            }

            try {
                const studioForNotify = await DbAdapter.findByPk(Studio, id);
                await DbAdapter.create(Notification, {
                    user_id: member.user_id,
                    type: 'system',
                    title: '工作室申请通过',
                    content: `您申请加入的工作室「${studioForNotify?.name || '工作室'}」已通过审核`,
                    related_id: Number(id),
                    related_type: 'studio',
                    sender_id: DbAdapter.getId(req.user)
                });
            } catch (notifyErr) {
                console.error('Create review notification error:', notifyErr);
            }

            return successResponse(res, null, '已通过申请');
        } else {
            // Reject 必须在 WHERE 带上 status:'pending',防止并发 approve/reject 把已 active 成员改 rejected
            const rejectAffected = await DbAdapter.update(StudioMember,
                { status: 'rejected' },
                { where: { id: memberId, studio_id: id, status: 'pending' } }
            );
            const rejectCount = Array.isArray(rejectAffected) ? rejectAffected[0] : rejectAffected;
            if (rejectCount === 0) {
                return errorResponse(res, '申请已处理或不存在', 400);
            }
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

        if (!sameId(studio.owner_id, DbAdapter.getId(req.user))) {
            return errorResponse(res, '只有创建者可以解散工作室', 403);
        }

        // M10: 多表关联删除必须用事务包裹，任一步失败整体回滚
        // Bug-6(死链): 同时清理 Notification 中 related_type='studio' 且 related_id 指向该工作室的记录,
        // 避免解散后用户点击消息列表中的工作室消息触发 404 死链
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(Notification, { where: { related_id: Number(id), related_type: 'studio' }, transaction: t });
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
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

        if (!sameId(work.user_id, DbAdapter.getId(req.user))) {
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
            user_id: DbAdapter.getId(req.user),
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });
        
        if (!adminMember || !isStudioManagerRole(adminMember.role)) {
            return errorResponse(res, '无权审核作品', 403);
        }
        
        // 🔴4 修复: 先查 studioWork 获取 user_id 发通知
        let studioWork = await DbAdapter.findOne(StudioWork, {
            where: { id: workId, studio_id: id }
        });
        
        if (!studioWork) {
            return errorResponse(res, '作品不存在', 404);
        }

        const VALID_ACTIONS = ['approve', 'reject'];
        if (!VALID_ACTIONS.includes(action)) {
            return errorResponse(res, '无效的操作', 400);
        }

        if (action === 'approve') {
            let approved = false;
            await sequelize.transaction(async (t) => {
                // 事务内 WHERE status='pending' 原子更新,防止并发双增 work_count
                const affectedRows = await DbAdapter.update(StudioWork, { 
                    status: 'approved', 
                    reviewed_by: DbAdapter.getId(req.user),
                    reviewed_at: new Date()
                }, { where: { id: workId, studio_id: id, status: 'pending' }, transaction: t });
                const count = Array.isArray(affectedRows) ? affectedRows[0] : affectedRows;
                if (count > 0) {
                    approved = true;
                    // 修复: 用 recalculateStudioStats 统一重算 work_count 和 total_score
                    // 避免"先评分后审核通过"时 total_score 不增加的漂移
                    await recalculateStudioStats(id, t);
                }
            });
            if (!approved) {
                return errorResponse(res, '作品申请已处理或不存在', 400);
            }
            
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
                    sender_id: DbAdapter.getId(req.user)
                });
            } catch (e) { console.error('创建审核通知失败:', e.message); }
            
            return successResponse(res, null, '作品已通过');
        } else {
            // Reject 必须在 WHERE 带上 status:'pending',防止并发 approve/reject 把 approved 作品改 rejected
            const rejectAffected = await DbAdapter.update(StudioWork, { 
                status: 'rejected',
                reviewed_by: DbAdapter.getId(req.user),
                reviewed_at: new Date()
            }, { where: { id: workId, studio_id: id, status: 'pending' } });
            const rejectCount = Array.isArray(rejectAffected) ? rejectAffected[0] : rejectAffected;
            if (rejectCount === 0) {
                return errorResponse(res, '作品申请已处理或不存在', 400);
            }
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });
        
        if (!adminMember || !isStudioManagerRole(adminMember.role)) {
            return errorResponse(res, '无权移除作品', 403);
        }
        
        const studioWork = await DbAdapter.findOne(StudioWork, {
            where: { id: workId, studio_id: id }
        });
        
        if (!studioWork) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        // wasApproved 在事务外读取存在 TOCTOU: destroy 返回 0 也不会回滚递减
        // 改为事务内用 where status='approved' 条件删除,仅受影响行>0 时才递减
        await sequelize.transaction(async (t) => {
            const destroyed = await DbAdapter.destroy(StudioWork, {
                where: { id: DbAdapter.getId(studioWork), studio_id: id, status: 'approved' },
                transaction: t
            });
            if (destroyed) {
                // 修复: 移除已评分作品时 total_score 也需减少,用 recalculateStudioStats 统一重算
                await recalculateStudioStats(id, t);
            } else {
                // 非 approved(如 pending/rejected): 直接删不重算
                await DbAdapter.destroy(StudioWork, {
                    where: { id: DbAdapter.getId(studioWork), studio_id: id },
                    transaction: t
                });
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });
        
        if (!adminMember || !isStudioManagerRole(adminMember.role)) {
            return errorResponse(res, '无权操作作品', 403);
        }
        
        const studioWork = await DbAdapter.findOne(StudioWork, {
            where: { id: workId, studio_id: id }
        });
        
        if (!studioWork) {
            return errorResponse(res, '作品不存在', 404);
        }
        
        if (action === 'down') {
            await sequelize.transaction(async (t) => {
                // 在事务内用 WHERE status='approved' 原子更新,防并发竞态
                const affected = await DbAdapter.update(StudioWork, { status: 'down' }, {
                    where: { id: workId, studio_id: id, status: 'approved' },
                    transaction: t
                });
                const cnt = Array.isArray(affected) ? affected[0] : affected;
                if (cnt === 0) {
                    throw new Error('当前状态不允许下架');
                }
                // 修复: 下架已评分作品时 total_score 也需减少,用 recalculateStudioStats 统一重算
                await recalculateStudioStats(id, t);
            });
            return successResponse(res, null, '作品已下架');
        } else if (action === 'up') {
            await sequelize.transaction(async (t) => {
                // 在事务内用 WHERE status='down' 原子更新,防并发竞态
                const affected = await DbAdapter.update(StudioWork, { status: 'approved' }, {
                    where: { id: workId, studio_id: id, status: 'down' },
                    transaction: t
                });
                const cnt = Array.isArray(affected) ? affected[0] : affected;
                if (cnt === 0) {
                    throw new Error('当前状态不允许上架');
                }
                // 修复: 上架已评分作品时 total_score 也需增加,用 recalculateStudioStats 统一重算
                await recalculateStudioStats(id, t);
            });
            return successResponse(res, null, '作品已上架');
        }
        
        return errorResponse(res, '无效操作', 400);
    } catch (error) {
        console.error('切换作品状态错误:', error);
        // 事务内抛出的业务状态错误应返回 400,避免全部吞成 500
        if (error.message === '当前状态不允许下架' || error.message === '当前状态不允许上架') {
            return errorResponse(res, error.message, 400);
        }
        return errorResponse(res, '操作失败', 500);
    }
}

async function getPendingMembers(req, res) {

    try {
        const { id } = req.params;
        
        const adminMember = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });
        
        if (!adminMember || !isStudioManagerRole(adminMember.role)) {
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });
        
        if (!adminMember || !isStudioManagerRole(adminMember.role)) {
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), role: 'owner' }
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
        
        // Bug-10/Bug-15: 整个 setMemberRole 操作(降级/提升副室长 + 改成员 role)必须在同一事务内,
        // 避免降级路径中清除 vice_owner_id 与改 role 不在同一事务导致并发不一致
        // 修复: studio 查询移入事务内,避免 TOCTOU 竞态(事务外读取的快照在事务内可能已过期)
        await sequelize.transaction(async (t) => {
            const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
            // 如果被修改的成员是副室长且角色降级，清除副室长引用
            if (member.role === 'vice_owner' && role !== 'vice_owner') {
                if (studio && sameId(studio.vice_owner_id, member.user_id)) {
                    await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: DbAdapter.getId(studio) }, transaction: t });
                }
            }
            // 如果提升为副室长，同步 studio.vice_owner_id（清除旧副室长角色）
            if (role === 'vice_owner') {
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
            }

            // 最后改成员 role,在同一事务内
            await DbAdapter.update(StudioMember, { role }, { where: { id: DbAdapter.getId(member) }, transaction: t });
        });
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
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });
        
        if (!adminMember || !isStudioManagerRole(adminMember.role)) {
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

        // 修复 BOLA: 副室长是 owner 亲自任命的二把手,只有 owner 才能踢出
        if (member.role === 'vice_owner' && adminMember.role !== 'owner') {
            return errorResponse(res, '无权移除副室长，仅创建者可操作', 403);
        }

        // 管理员只有 owner 或副室长才能踢出
        if (member.role === 'admin' && adminMember.role !== 'owner' && adminMember.role !== 'vice_owner') {
            return errorResponse(res, '无权移除管理员', 403);
        }

        // M2/Bug-19: 踢出成员+计数-1+清理副室长引用需事务保证一致性
        // 原子递减用模型级 where member_count>0,不再依赖旧实例 member_count 判断
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(StudioMember, { where: { id: DbAdapter.getId(member) }, transaction: t });
            await DbAdapter.decrement(Studio, 'member_count', {
                where: { id: id, member_count: { [Op.gt]: 0 } },
                transaction: t
            });
            // 如果被移除者是副室长，清除引用
            const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
            if (studio && sameId(studio.vice_owner_id, member.user_id)) {
                await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: id }, transaction: t });
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
        if (String(user_id) === String(DbAdapter.getId(req.user))) {
            return errorResponse(res, '不能将自己设为副室长', 400);
        }

        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });
        
        if (!member || member.role !== 'owner') {
            return errorResponse(res, '只有室长可以设置副室长', 403);
        }

        // 🔴3 修复: 整个任命+降级逻辑全部在事务内,防止并发多副室长
        if (user_id) {
            await sequelize.transaction(async (t) => {
                // 1) 确认目标成员仍在(事务内查询避免幻读)
                const viceMember = await DbAdapter.findOne(StudioMember, {
                    where: { studio_id: id, user_id: user_id, status: 'active' },
                    transaction: t
                });
                if (!viceMember) {
                    throw new Error('该用户不是工作室成员');
                }

                // 2) 读当前 studio,降级旧副室长(仅当 role 仍是 vice_owner 时)
                const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
                if (studio && studio.vice_owner_id) {
                    await DbAdapter.update(StudioMember,
                        { role: 'member' },
                        { where: { studio_id: id, user_id: studio.vice_owner_id, role: 'vice_owner' }, transaction: t }
                    );
                }
                // 3) 设置新副室长
                await DbAdapter.update(Studio,
                    { vice_owner_id: user_id },
                    { where: { id: id }, transaction: t }
                );
                await DbAdapter.update(StudioMember,
                    { role: 'vice_owner' },
                    { where: { id: DbAdapter.getId(viceMember), role: { [Op.ne]: 'owner' } }, transaction: t }
                );
            });
        } else {
            // 取消副室长的事务也在当前 studio 快照内
            await sequelize.transaction(async (t) => {
                const studio = await DbAdapter.findByPk(Studio, id, { transaction: t });
                if (studio && studio.vice_owner_id) {
                    await DbAdapter.update(StudioMember,
                        { role: 'member' },
                        { where: { studio_id: id, user_id: studio.vice_owner_id }, transaction: t }
                    );
                    await DbAdapter.update(Studio, { vice_owner_id: null }, { where: { id: id }, transaction: t });
                }
            });
        }

        const updatedStudio = await DbAdapter.findByPk(Studio, id);
        return successResponse(res, updatedStudio, '副室长已设置');
    } catch (error) {
        console.error('设置副室长错误:', error);
        // 事务内抛出的业务状态错误应返回 400,避免全部吞成 500
        if (error.message === '该用户不是工作室成员') {
            return errorResponse(res, error.message, 400);
        }
        return errorResponse(res, '设置失败', 500);
    }
}

async function dissolveStudio(req, res) {
    try {
        const { id } = req.params;

        const member = await DbAdapter.findOne(StudioMember, {
            where: { studio_id: id, user_id: DbAdapter.getId(req.user), status: 'active' }
        });

        if (!member || member.role !== 'owner') {
            return errorResponse(res, '只有室长可以解散工作室', 403);
        }

        // M10: 多表关联删除必须用事务包裹，任一步失败整体回滚
        // Bug-6(死链): 同时清理 Notification
        await sequelize.transaction(async (t) => {
            await DbAdapter.destroy(Notification, { where: { related_id: Number(id), related_type: 'studio' }, transaction: t });
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

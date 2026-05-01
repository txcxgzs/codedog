/**
 * 用户控制器
 * 仅支持编程猫账号登录
 */

const { User, Work, SystemConfig } = require('../models');
const { successResponse, errorResponse } = require('../middleware/response');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');
const codemaoApi = require('../services/codemaoApi');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DbAdapter = require('../utils/dbAdapter');
const { Op } = require('sequelize');
const GeetestService = require('../services/geetestService');

const uploadDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件'));
        }
    }
});

/**
 * 用户登录（仅支持编程猫账号）
 */
async function login(req, res) {
    try {
        const { username, password, geetest_challenge, geetest_validate, geetest_seccode } = req.body;
        
        if (!username || !password) {
            return errorResponse(res, '请输入用户名和密码', 400);
        }
        
        const result = await GeetestService.verify(
            'login', 
            geetest_challenge, 
            geetest_validate, 
            geetest_seccode, 
            req
        );
        
        if (!result.success) {
            return errorResponse(res, result.reason || '请完成验证码验证', 400, 'CAPTCHA_FAILED');
        }
        
        return await codemaoLogin(req, res, username, password);
    } catch (error) {
        console.error('登录错误:', error);
        return errorResponse(res, '登录失败，请稍后重试', 500);
    }
}

/**
 * 编程猫账号登录
 * 第一个使用编程猫登录的用户将自动成为管理员
 */
async function codemaoLogin(req, res, identity, password) {
    try {
        const codemaoRes = await codemaoApi.login(identity, password);
        
        console.log('编程猫登录响应:', JSON.stringify(codemaoRes, null, 2));
        
        if (!codemaoRes) {
            return errorResponse(res, '编程猫服务暂时不可用，请稍后重试', 502);
        }
        
        if (codemaoRes.error) {
            // 根据不同错误类型返回友好提示
            const errorMsg = getLoginErrorMessage(codemaoRes);
            const statusCode = codemaoRes.status || 401;
            return errorResponse(res, errorMsg, statusCode);
        }
        
        if (!codemaoRes.user_info) {
            return errorResponse(res, '用户名或密码错误，请检查后重试', 401);
        }
        
        const codemaoUser = codemaoRes.user_info;
        const codemaoToken = codemaoRes.auth?.token || codemaoRes.token || null;
        
        // 使用 findOrCreate 避免竞态条件
        let user, created;
        try {
            [user, created] = await DbAdapter.findOrCreate(User, {
                where: { codemao_user_id: codemaoUser.id },
                defaults: {
                    codemao_user_id: codemaoUser.id,
                    username: `codemao_${codemaoUser.id}`,
                    email: codemaoRes.auth?.email || `codemao_${codemaoUser.id}@placeholder.com`,
                    password: await bcrypt.hash(Math.random().toString(36), 10),
                    nickname: codemaoUser.nickname,
                    avatar: codemaoUser.avatar_url,
                    bio: codemaoUser.description,
                    codemao_token: codemaoToken,
                    role: 'user',
                    status: 'active'
                }
            });
        } catch (createError) {
            // 如果创建失败（可能是并发创建），尝试再次查找
            user = await DbAdapter.findOne(User, { 
                where: { codemao_user_id: codemaoUser.id } 
            });
            created = false;
            if (!user) {
                throw createError;
            }
        }
        
        // 如果是新创建的用户，检查是否是第一个用户（自动成为管理员）
        let isFirstUser = false;
        if (created) {
            const userCount = await DbAdapter.count(User, {});
            if (userCount === 1) {
                isFirstUser = true;
                await DbAdapter.update(User, { role: 'superadmin' }, { where: { id: DbAdapter.getId(user) } });
                user.role = 'superadmin';
                console.log(`✅ 第一个用户 ${codemaoUser.nickname} 已自动成为超级管理员`);
            }
        }
        
        // 更新用户信息
        if (!created) {
            await DbAdapter.update(User, {
                nickname: codemaoUser.nickname,
                avatar: codemaoUser.avatar_url,
                bio: codemaoUser.description,
                codemao_token: codemaoToken
            }, { where: { id: DbAdapter.getId(user) } });
        }
        
        syncUserWorks(codemaoUser.id, DbAdapter.getId(user)).catch(err => {
            console.error('同步用户作品失败:', err);
        });
        
        const token = jwt.sign(
            { id: DbAdapter.getId(user), username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        // 构建返回消息
        let message = '编程猫登录成功';
        if (isFirstUser) {
            message = '编程猫登录成功，您是第一个用户，已自动成为管理员';
        }
        
        return successResponse(res, {
            token,
            user: {
                id: DbAdapter.getId(user),
                codemao_user_id: user.codemao_user_id,
                username: user.username,
                email: user.email,
                nickname: user.nickname,
                avatar: user.avatar,
                bio: user.bio,
                role: user.role
            },
            syncingWorks: true  // 提示前端作品正在同步中
        }, message);
    } catch (error) {
        console.error('编程猫登录错误:', error);
        return errorResponse(res, '编程猫登录失败', 500);
    }
}

/**
 * 同步用户作品
 */
async function syncUserWorks(codemaoUserId, localUserId) {
    try {
        console.log(`开始同步用户 ${codemaoUserId} 的作品...`);
        
        const worksData = await codemaoApi.getUserWorks(codemaoUserId, 0, 50);
        
        if (!worksData || !worksData.items) {
            console.log('未获取到用户作品');
            return;
        }
        
        let syncCount = 0;
        
        for (const item of worksData.items) {
            const existing = await DbAdapter.findOne(Work, { 
                where: { codemao_work_id: item.id } 
            });
            
            if (existing) continue;
            
            const workDetail = await codemaoApi.getWorkDetail(item.id);
            if (!workDetail || !workDetail.id) continue;
            
            const type = workDetail.work_label_list && workDetail.work_label_list[0] 
                ? workDetail.work_label_list[0].label_name 
                : '其他';
            
            await DbAdapter.create(Work, {
                codemao_work_id: workDetail.id,
                name: workDetail.work_name,
                description: workDetail.description,
                preview: workDetail.preview,
                type: type,
                ide_type: workDetail.ide_type,
                work_url: workDetail.player_url,
                user_id: localUserId,
                codemao_author_id: codemaoUserId,
                codemao_author_name: workDetail.user_info?.nickname,
                view_times: workDetail.view_times || 0,
                praise_times: workDetail.liked_times || 0,
                collection_times: workDetail.collect_times || 0,
                comment_count: workDetail.comment_times || 0,
                status: 'published'
            });
            
            syncCount++;
        }
        
        await DbAdapter.update(User, { work_count: syncCount }, { where: { id: localUserId } });
        
        console.log(`同步完成，共 ${syncCount} 个作品`);
    } catch (error) {
        console.error('同步用户作品错误:', error);
    }
}

/**
 * 获取当前用户信息
 */
async function getCurrentUser(req, res) {
    try {
        const user = await DbAdapter.findByPk(User, DbAdapter.getId(req.user), {
            attributes: { exclude: ['password'] }
        });
        
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        return successResponse(res, user);
    } catch (error) {
        console.error('获取用户信息错误:', error);
        return errorResponse(res, '获取用户信息失败', 500);
    }
}

/**
 * 更新用户资料
 */
async function updateProfile(req, res) {
    try {
        const { nickname, bio, doing, geetest_challenge, geetest_validate, geetest_seccode } = req.body;
        
        const result = await GeetestService.verify(
            'update_profile', 
            geetest_challenge, 
            geetest_validate, 
            geetest_seccode, 
            req
        );
        
        if (!result.success) {
            return errorResponse(res, '请完成验证码验证', 400);
        }
        
        const user = await DbAdapter.findByPk(User, DbAdapter.getId(req.user));
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        let avatar = user.avatar;
        if (req.file) {
            avatar = `/uploads/avatars/${req.file.filename}`;
        }
        
        await DbAdapter.update(User, {
            nickname: nickname || user.nickname,
            avatar: avatar,
            bio: bio !== undefined ? bio : user.bio,
            doing: doing !== undefined ? doing : user.doing
        }, { where: { id: DbAdapter.getId(user) } });
        
        const updatedUser = await DbAdapter.findByPk(User, DbAdapter.getId(user));
        
        return successResponse(res, {
            id: DbAdapter.getId(updatedUser),
            username: updatedUser.username,
            nickname: updatedUser.nickname,
            avatar: updatedUser.avatar,
            bio: updatedUser.bio,
            doing: updatedUser.doing
        }, '资料更新成功');
    } catch (error) {
        console.error('更新资料错误:', error);
        return errorResponse(res, '更新资料失败', 500);
    }
}

/**
 * 获取用户公开信息（使用编程猫用户ID）
 */
async function getUserById(req, res) {
    try {
        const { codemaoId } = req.params;
        
        // 同时支持通过编程猫ID和本地ID查询
        const where = {};
        if (isNaN(codemaoId)) {
            // 如果不是数字，可能是编程猫的特殊ID（虽然通常是数字）
            where.codemao_user_id = codemaoId;
        } else {
            // 如果是数字，尝试匹配本地ID或编程猫ID
            where[Op.or] = [
                { id: codemaoId },
                { codemao_user_id: codemaoId }
            ];
        }

        const user = await DbAdapter.findOne(User, {
            where,
            attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio', 'doing', 'level', 'follower_count', 'following_count', 'work_count', 'created_at']
        });
        
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        return successResponse(res, user);
    } catch (error) {
        console.error('获取用户信息错误:', error);
        return errorResponse(res, '获取用户信息失败', 500);
    }
}

/**
 * 通过本地ID获取用户（内部使用）
 */
async function getUserByLocalId(req, res) {
    try {
        const { id } = req.params;
        
        const user = await DbAdapter.findByPk(User, id, {
            attributes: ['id', 'codemao_user_id', 'username', 'nickname', 'avatar', 'bio', 'doing', 'level', 'follower_count', 'following_count', 'work_count', 'created_at']
        });
        
        if (!user) {
            return errorResponse(res, '用户不存在', 404);
        }
        
        return successResponse(res, user);
    } catch (error) {
        console.error('获取用户信息错误:', error);
        return errorResponse(res, '获取用户信息失败', 500);
    }
}

/**
 * 根据编程猫API返回的错误信息生成友好的错误提示
 */
function getLoginErrorMessage(codemaoRes) {
    const message = codemaoRes.message || '';
    const errorCode = codemaoRes.error_code || codemaoRes.code;
    
    // 常见错误类型映射
    const errorMap = {
        'user_not_found': '用户不存在，请检查用户名是否正确',
        'password_error': '密码错误，请重新输入',
        'password_incorrect': '密码错误，请重新输入',
        'account_disabled': '账号已被禁用，请联系编程猫客服',
        'account_banned': '账号已被封禁，请联系编程猫客服',
        'account_locked': '账号已被锁定，请稍后重试或联系客服',
        'too_many_attempts': '登录尝试次数过多，请稍后重试',
        'invalid_credentials': '用户名或密码错误',
        'network_error': '网络连接失败，请检查网络后重试',
        'server_error': '编程猫服务暂时不可用，请稍后重试'
    };
    
    // 根据错误码查找
    if (errorCode && errorMap[errorCode]) {
        return errorMap[errorCode];
    }
    
    // 根据错误信息关键词判断
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('password') || lowerMessage.includes('密码')) {
        return '密码错误，请重新输入';
    }
    if (lowerMessage.includes('user') || lowerMessage.includes('用户') || lowerMessage.includes('not found')) {
        return '用户不存在，请检查用户名是否正确';
    }
    if (lowerMessage.includes('disabled') || lowerMessage.includes('banned') || lowerMessage.includes('禁用') || lowerMessage.includes('封禁')) {
        return '账号已被禁用，请联系编程猫客服';
    }
    if (lowerMessage.includes('locked') || lowerMessage.includes('锁定')) {
        return '账号已被锁定，请稍后重试';
    }
    if (lowerMessage.includes('too many') || lowerMessage.includes('频繁')) {
        return '操作过于频繁，请稍后重试';
    }
    
    // 默认返回原始信息或通用提示
    return message || '登录失败，请检查用户名和密码';
}

module.exports = {
    login,
    getCurrentUser,
    updateProfile,
    getUserById,
    getUserByLocalId
};

const express = require('express');
const router = express.Router();
const { GeetestLib } = require('../services/geetest');
const { successResponse, errorResponse } = require('../middleware/response');
const { SystemConfig, CaptchaStats } = require('../models');
const DbAdapter = require('../utils/dbAdapter');
const { Op } = require('sequelize');
// 修复: 引入限流器,为 GET /register 添加专项限流
// 该接口每次请求都会查配置并向极验发起外部注册请求(SDK 最长可等待 10 秒),
// 全局写限流主动跳过 GET,匿名用户可反复触发造成资源耗尽
const { createRateLimiter } = require('../middleware/rateLimit');

// 从环境变量获取默认配置
const GEETEST_ID = process.env.GEETEST_ID || '';
const GEETEST_KEY = process.env.GEETEST_KEY || '';

// 极验注册专项限流: 单 IP 每分钟最多 10 次,防止匿名资源耗尽
const geetestRegisterRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: 'geetest-register'
});

async function recordStats(type, scene, action, req) {
    try {
        await DbAdapter.create(CaptchaStats, {
            type,
            scene,
            action,
            ip: req.ip || req.connection?.remoteAddress,
            user_agent: req.headers['user-agent']?.substring(0, 500)
        });
    } catch (e) {
        console.error('记录验证码统计失败:', e);
    }
}

router.get('/config', async (req, res) => {
    try {
        const configKeys = [
            'geetest_enabled', 'geetest_id', 'geetest_product',
            'geetest_login', 'geetest_register', 'geetest_like',
            'geetest_comment', 'geetest_reply', 'geetest_report',
            'geetest_publish_work', 'geetest_publish_post',
            'geetest_favorite', 'geetest_remove_favorite', 'geetest_update_profile',
            'geetest_create_studio', 'geetest_join_studio', 
            'geetest_submit_work', 'geetest_review_member', 'geetest_studio_management', 'geetest_developer_app',
            'geetest_im_message', 'geetest_im_search', 'geetest_im_create_group'
        ];
        
        const configs = await DbAdapter.findAll(SystemConfig, {
            where: { config_key: { [Op.in]: configKeys } }
        });
        
        const configMap = {};
        configs.forEach(c => {
            configMap[c.config_key] = c.config_value;
        });
        
        const geetestId = configMap.geetest_id || '';
        const enabled = configMap.geetest_enabled === 'true' && !!geetestId;
        
        return successResponse(res, {
            enabled,
            captcha_id: geetestId,
            product: configMap.geetest_product || 'popup',
            scenes: {
                login: configMap.geetest_login === 'true',
                register: configMap.geetest_register === 'true',
                like: configMap.geetest_like === 'true',
                comment: configMap.geetest_comment === 'true',
                reply: configMap.geetest_reply === 'true',
                report: configMap.geetest_report === 'true',
                publish_work: configMap.geetest_publish_work === 'true',
                publish_post: configMap.geetest_publish_post === 'true',
                favorite: configMap.geetest_favorite === 'true',
                remove_favorite: configMap.geetest_remove_favorite === 'true',
                update_profile: configMap.geetest_update_profile === 'true',
                create_studio: configMap.geetest_create_studio === 'true',
                join_studio: configMap.geetest_join_studio === 'true',
                submit_work: configMap.geetest_submit_work === 'true',
                review_member: configMap.geetest_review_member === 'true',
                studio_management: configMap.geetest_studio_management !== 'false',
                developer_app: configMap.geetest_developer_app === 'true',
                // 新增 IM 场景在未保存过配置时默认开启；管理员仍可显式关闭。
                im_message: configMap.geetest_im_message !== 'false',
                im_search: configMap.geetest_im_search !== 'false',
                im_create_group: configMap.geetest_im_create_group !== 'false'
            }
        });
    } catch (error) {
        console.error('获取极验配置错误:', error);
        return errorResponse(res, '获取配置失败', 500);
    }
});

router.post('/show', async (req, res) => {
    try {
        const { scene } = req.body;
        await recordStats('geetest', scene || 'global', 'show', req);
        return successResponse(res, null, '记录成功');
    } catch (error) {
        console.error('记录展示错误:', error);
        return errorResponse(res, '记录失败', 500);
    }
});

router.get('/register', geetestRegisterRateLimiter, async (req, res) => {
    try {
        let geetestId = GEETEST_ID;
        let geetestKey = GEETEST_KEY;
        
        const idConfig = await DbAdapter.findOne(SystemConfig, { where: { config_key: 'geetest_id' } });
        if (idConfig && idConfig.config_value) {
            geetestId = idConfig.config_value;
        }
        
        const keyConfig = await DbAdapter.findOne(SystemConfig, { where: { config_key: 'geetest_key' } });
        if (keyConfig && keyConfig.config_value) {
            geetestKey = keyConfig.config_value;
        }
        
        if (!geetestId || !geetestKey) {
            return errorResponse(res, '极验未配置', 400);
        }
        
        const geetest = new GeetestLib(geetestId, geetestKey);
        const result = await geetest.register('md5');
        
        return successResponse(res, result);
    } catch (error) {
        console.error('极验注册错误:', error);
        return errorResponse(res, '验证码注册失败', 500);
    }
});

router.post('/validate', async (req, res) => {
    let scene = 'global';
    try {
        const { challenge, validate, seccode, scene: reqScene } = req.body;
        scene = reqScene || 'global';
        
        let geetestId = GEETEST_ID;
        let geetestKey = GEETEST_KEY;
        
        const idConfig = await DbAdapter.findOne(SystemConfig, { where: { config_key: 'geetest_id' } });
        if (idConfig && idConfig.config_value) {
            geetestId = idConfig.config_value;
        }
        
        const keyConfig = await DbAdapter.findOne(SystemConfig, { where: { config_key: 'geetest_key' } });
        if (keyConfig && keyConfig.config_value) {
            geetestKey = keyConfig.config_value;
        }
        
        if (!geetestId || !geetestKey) {
            return errorResponse(res, '极验未配置', 400);
        }
        
        // 修复跨实例 bug: /validate 创建的是新 GeetestLib 实例，从未调用过 register()，
        // lastRegisterSuccess 默认为 true，fallback 为 false（正常模式）。
        // 当极验宕机时，/register 探测到故障返回本地随机 challenge，
        // 但 /validate 仍以 fallback=false 向极验服务器发起真实验证，必然失败。
        // 修复方案: validate 前先调用 register() 探测极验服务状态，更新实例的 lastRegisterSuccess 字段，
        // 这样 validate 时能正确决定 fallback 模式（极验宕机时走本地校验 seccode）。
        const geetest = new GeetestLib(geetestId, geetestKey);
        await geetest.register();

        // 再执行 validate，根据 lastRegisterSuccess 决定 fallback 模式
        const result = await geetest.validate(challenge, validate, seccode);
        
        if (result.result === 'success') {
            await recordStats('geetest', scene || 'global', 'pass', req);
            return successResponse(res, { validated: true }, '验证成功');
        } else {
            await recordStats('geetest', scene || 'global', 'block', req);
            return errorResponse(res, result.reason, 400);
        }
    } catch (error) {
        console.error('极验验证错误:', error);
        await recordStats('geetest', scene || 'global', 'block', req);
        return errorResponse(res, '验证失败', 500);
    }
});

module.exports = router;

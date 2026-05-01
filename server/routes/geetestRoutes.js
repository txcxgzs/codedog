const express = require('express');
const router = express.Router();
const { GeetestLib } = require('../services/geetest');
const { successResponse, errorResponse } = require('../middleware/response');
const { SystemConfig, CaptchaStats } = require('../models');
const DbAdapter = require('../utils/dbAdapter');
const { Op } = require('sequelize');

// 从环境变量获取默认配置
const GEETEST_ID = process.env.GEETEST_ID || '';
const GEETEST_KEY = process.env.GEETEST_KEY || '';

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
            'geetest_submit_work', 'geetest_review_member'
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
                review_member: configMap.geetest_review_member === 'true'
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

router.get('/register', async (req, res) => {
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
    try {
        const { challenge, validate, seccode, scene } = req.body;
        
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

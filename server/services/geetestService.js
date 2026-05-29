/**
 * 极验验证码服务
 * 封装 GeetestLib 并提供场景化验证功能
 */

const { GeetestLib } = require('./geetest');
const { SystemConfig, CaptchaStats } = require('../models');
const DbAdapter = require('../utils/dbAdapter');
const { Op } = require('sequelize');

// 从环境变量获取默认配置
const GEETEST_ID = process.env.GEETEST_ID || '';
const GEETEST_KEY = process.env.GEETEST_KEY || '';

class GeetestService {
    /**
     * 获取极验配置（优先使用数据库配置）
     */
    static async getConfig() {
        try {
            const configKeys = [
                'geetest_enabled', 'geetest_id', 'geetest_key',
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

            const geetestId = configMap.geetest_id || GEETEST_ID;
            const geetestKey = configMap.geetest_key || GEETEST_KEY;
            const enabled = configMap.geetest_enabled === 'true' && !!geetestId;

            return {
                geetestId,
                geetestKey,
                enabled,
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
            };
        } catch (error) {
            console.error('获取极验配置失败:', error);
            return {
                geetestId: GEETEST_ID,
                geetestKey: GEETEST_KEY,
                enabled: false,
                scenes: {}
            };
        }
    }

    /**
     * 验证验证码
     * @param {string} scene - 验证场景（login, comment, like 等）
     * @param {string} challenge - 极验 challenge 参数
     * @param {string} validate - 极验 validate 参数
     * @param {string} seccode - 极验 seccode 参数
     * @param {object} req - Express 请求对象
     */
    static async verify(scene, challenge, validate, seccode, req) {
        try {
            const config = await this.getConfig();

            // 如果未启用验证码，直接返回成功
            if (!config.enabled) {
                console.log('[极验] 未启用，跳过验证');
                return { success: true };
            }

            // 检查配置是否完整
            if (!config.geetestId || !config.geetestKey) {
                console.log('[极验] 配置不完整，跳过验证');
                return { success: true };
            }

            // 检查当前场景是否启用了验证码，未启用则跳过
            if (!config.scenes[scene]) {
                console.log(`[极验] 场景 ${scene} 未启用，跳过验证`);
                return { success: true };
            }

            // 记录验证码统计
            await this.recordStats(scene, 'verify', req);

            // 检查是否提供了验证参数
            if (!challenge || !validate || !seccode) {
                return { success: false, reason: '请完成验证码验证' };
            }

            // 创建极验实例并验证
            const geetest = new GeetestLib(config.geetestId, config.geetestKey);
            const result = await geetest.validate(challenge, validate, seccode);

            if (result.result === 'success') {
                await this.recordStats(scene, 'pass', req);
                return { success: true };
            } else {
                await this.recordStats(scene, 'fail', req);
                return { success: false, reason: result.reason || '验证失败' };
            }
        } catch (error) {
            console.error('[极验] 验证异常:', error);
            await this.recordStats(scene, 'error', req);
            return { success: false, reason: '验证服务异常' };
        }
    }

    /**
     * 记录验证码统计
     */
    static async recordStats(scene, action, req) {
        try {
            await DbAdapter.create(CaptchaStats, {
                type: 'geetest',
                scene: scene || 'global',
                action: action || 'unknown',
                ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
                user_agent: req?.headers?.['user-agent']?.substring(0, 500) || 'unknown'
            });
        } catch (e) {
            console.error('记录极验统计失败:', e);
        }
    }
}

module.exports = GeetestService;

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
            const [idConfig, keyConfig, enabledConfig] = await Promise.all([
                DbAdapter.findOne(SystemConfig, { where: { config_key: 'geetest_id' } }),
                DbAdapter.findOne(SystemConfig, { where: { config_key: 'geetest_key' } }),
                DbAdapter.findOne(SystemConfig, { where: { config_key: 'geetest_enabled' } })
            ]);

            return {
                geetestId: (idConfig && idConfig.config_value) || GEETEST_ID,
                geetestKey: (keyConfig && keyConfig.config_value) || GEETEST_KEY,
                enabled: (enabledConfig && enabledConfig.config_value) === 'true'
            };
        } catch (error) {
            console.error('获取极验配置失败:', error);
            return {
                geetestId: GEETEST_ID,
                geetestKey: GEETEST_KEY,
                enabled: false
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

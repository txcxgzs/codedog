const { GeetestLib } = require('./geetest');
const { SystemConfig, CaptchaStats } = require('../models');
const DbAdapter = require('../utils/dbAdapter');

const GEETEST_ID = process.env.GEETEST_ID || '';
const GEETEST_KEY = process.env.GEETEST_KEY || '';

class GeetestService {
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
            console.error('[Geetest] failed to load config:', error);
            return {
                geetestId: GEETEST_ID,
                geetestKey: GEETEST_KEY,
                enabled: false
            };
        }
    }

    static async verify(scene, challenge, validate, seccode, req) {
        try {
            const config = await this.getConfig();

            if (!config.enabled) {
                // 验证码未启用，按设计放行，但记录告警日志便于运维排查
                console.warn('[Geetest] 验证码未启用，所有验证放行');
                return { success: true };
            }

            if (!config.geetestId || !config.geetestKey) {
                await this.recordStats(scene, 'misconfigured', req);
                return { success: false, reason: '验证码配置不完整' };
            }

            // 修复: 参数校验提前到 recordStats('verify') 之前,避免统计口径不一致
            if (!challenge || !validate || !seccode) {
                await this.recordStats(scene, 'fail', req);
                return { success: false, reason: '请完成验证码验证' };
            }

            await this.recordStats(scene, 'verify', req);

            const geetest = new GeetestLib(config.geetestId, config.geetestKey);
            // 先调用 register 检测极验服务是否可达，以便 validate 选择正确的 fallback 模式
            // register 成功(success=1) → validate 用 fallback=false(服务器校验，安全)
            // register 失败(success=0，极验宕机) → validate 用 fallback=true(本地校验 seccode，避免 DoS)
            // 此处 register 的返回值(challenge)不使用，仅为探测极验服务状态并更新实例的 lastRegisterSuccess
            await geetest.register();
            const result = await geetest.validate(challenge, validate, seccode);

            if (result.result === 'success') {
                await this.recordStats(scene, 'pass', req);
                return { success: true };
            }

            await this.recordStats(scene, 'fail', req);
            return { success: false, reason: result.reason || '验证码验证失败' };
        } catch (error) {
            console.error('[Geetest] verify error:', error);
            await this.recordStats(scene, 'error', req);
            return { success: false, reason: '验证码服务异常' };
        }
    }

    static async recordStats(scene, action, req) {
        try {
            await DbAdapter.create(CaptchaStats, {
                type: 'geetest',
                scene: scene || 'global',
                action: action || 'unknown',
                ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
                user_agent: req?.headers?.['user-agent']?.substring(0, 500) || 'unknown'
            });
        } catch (error) {
            console.error('[Geetest] failed to record stats:', error);
        }
    }
}

module.exports = GeetestService;

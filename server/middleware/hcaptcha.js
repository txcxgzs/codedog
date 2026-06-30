/**
 * hCaptcha验证中间件
 */

const DbAdapter = require('../utils/dbAdapter');
const { SystemConfig } = require('../models');
const { errorResponse } = require('../middleware/response');
const axios = require('axios');

let hcaptchaEnabledCache = null;
let hcaptchaCacheExpiry = 0;
const HCAPTCHA_CACHE_TTL = 60 * 1000;

async function isHcaptchaEnabled() {
    const now = Date.now();
    if (hcaptchaEnabledCache !== null && now < hcaptchaCacheExpiry) {
        return hcaptchaEnabledCache;
    }

    try {
        const enabledConfig = await DbAdapter.findOne(SystemConfig, { where: { config_key: 'hcaptcha_enabled' } });
        hcaptchaEnabledCache = enabledConfig && enabledConfig.config_value === 'true';
        hcaptchaCacheExpiry = now + HCAPTCHA_CACHE_TTL;
        return hcaptchaEnabledCache;
    } catch (error) {
        console.error('获取hCaptcha配置失败:', error);
        return hcaptchaEnabledCache ?? false;
    }
}

async function hcaptchaGuard(req, res, next) {
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    const excludePaths = [
        '/api/users/login',
        '/api/users/register',
        '/api/health',
        '/api/hcaptcha',
        '/api/geetest',
        '/api/admin',
        '/api/public'
    ];

    if (excludePaths.some(p => req.path.startsWith(p))) {
        return next();
    }

    try {
        const enabled = await isHcaptchaEnabled();
        if (!enabled) {
            return next();
        }

        const verified = req.session?.hcaptchaVerified;
        const expireTime = req.session?.hcaptchaExpires;

        if (verified && expireTime && Date.now() < expireTime) {
            return next();
        }

        return errorResponse(res, '需要完成hCaptcha验证', 403, 'HCAPTCHA_REQUIRED');
    } catch (error) {
        // 数据库故障时拒绝请求而非放行，避免 fail-open 安全风险
        console.error('hCaptcha中间件错误:', error);
        return errorResponse(res, '验证服务暂时不可用，请稍后重试', 503);
    }
}

async function verifyHcaptcha(token, secret) {
    try {
        const response = await axios.post('https://hcaptcha.com/siteverify', null, {
            params: {
                secret,
                response: token
            }
        });
        return response.data.success;
    } catch (error) {
        console.error('hCaptcha验证失败:', error);
        return false;
    }
}

function invalidateHcaptchaCache() {
    hcaptchaEnabledCache = null;
    hcaptchaCacheExpiry = 0;
}

module.exports = { hcaptchaGuard, verifyHcaptcha, invalidateHcaptchaCache };

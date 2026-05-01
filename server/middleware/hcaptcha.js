/**
 * hCaptcha验证中间件
 */

const DbAdapter = require('../utils/dbAdapter');
const { SystemConfig } = require('../models');
const { errorResponse } = require('../middleware/response');
const axios = require('axios');

async function hcaptchaGuard(req, res, next) {
    const excludePaths = [
        '/api/users/login',
        '/api/users/register',
        '/api/hcaptcha',
        '/api/geetest',
        '/api/admin'
    ];
    
    if (excludePaths.some(p => req.path.startsWith(p))) {
        return next();
    }
    
    try {
        const enabledConfig = await DbAdapter.findOne(SystemConfig, { where: { config_key: 'hcaptcha_enabled' } });
        if (!enabledConfig || enabledConfig.config_value !== 'true') {
            return next();
        }
        
        const verified = req.session?.hcaptchaVerified;
        const expireTime = req.session?.hcaptchaExpires;
        
        if (verified && expireTime && Date.now() < expireTime) {
            return next();
        }
        
        return errorResponse(res, '需要完成hCaptcha验证', 403, 'HCAPTCHA_REQUIRED');
    } catch (error) {
        console.error('hCaptcha中间件错误:', error);
        return next();
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

module.exports = { hcaptchaGuard, verifyHcaptcha };

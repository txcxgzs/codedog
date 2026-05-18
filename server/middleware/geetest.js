const GeetestService = require('../services/geetestService');
const { errorResponse } = require('./response');

function geetestVerify(scene) {
    return async (req, res, next) => {
        try {
            const config = await GeetestService.getConfig();
            
            // 如果极验未启用或配置不完整，直接放行（不需要验证码）
            if (!config.enabled || !config.geetestId || !config.geetestKey) {
                console.log(`[极验] 场景 ${scene} 验证未启用，直接放行`);
                return next();
            }
            
            // 启用了验证，必须检查验证码参数
            const { geetest_challenge, geetest_validate, geetest_seccode } = req.body;
            
            // 先检查参数是否提供
            if (!geetest_challenge || !geetest_validate || !geetest_seccode) {
                return errorResponse(res, '请完成验证码验证', 400);
            }
            
            // 实际执行验证
            const result = await GeetestService.verify(
                scene, 
                geetest_challenge, 
                geetest_validate, 
                geetest_seccode, 
                req
            );
            
            if (result.success) {
                return next();
            } else {
                return errorResponse(res, '验证码验证失败: ' + (result.reason || '未知错误'), 400);
            }
        } catch (error) {
            console.error('[极验] 验证中间件错误:', error);
            return errorResponse(res, '验证码服务异常', 500);
        }
    };
}

module.exports = { geetestVerify };

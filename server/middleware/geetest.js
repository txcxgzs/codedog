const GeetestService = require('../services/geetestService');
const { errorResponse } = require('./response');

function geetestVerify(scene) {
    return async (req, res, next) => {
        try {
            // 修复: 不在 middleware 层提前拦截缺失参数,而是交给 GeetestService.verify 统一判断
            // 原因: 极验未启用时 config.enabled=false, verify 会直接放行(success:true),
            //       但原代码的提前拦截会导致"未启用极验也无法发帖"
            const { geetest_challenge, geetest_validate, geetest_seccode } = req.body || {};

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
                return errorResponse(res, result.reason || '验证码验证失败', 400);
            }
        } catch (error) {
            console.error('验证码验证异常:', error);
            return errorResponse(res, '验证码服务异常', 500);
        }
    };
}

module.exports = { geetestVerify };
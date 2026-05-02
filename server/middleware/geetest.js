const GeetestService = require('../services/geetestService');
const { errorResponse } = require('./response');

function geetestVerify(scene) {
    return async (req, res, next) => {
        try {
            const { geetest_challenge, geetest_validate, geetest_seccode } = req.body;
            
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
            console.error('[geetestVerify] 中间件异常:', error);
            return errorResponse(res, '验证码验证服务异常', 500);
        }
    };
}

module.exports = { geetestVerify };

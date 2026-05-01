const GeetestService = require('../services/geetestService');
const { errorResponse } = require('./response');

function geetestVerify(scene) {
    return async (req, res, next) => {
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
    };
}

module.exports = { geetestVerify };

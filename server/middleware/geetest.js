const GeetestService = require('../services/geetestService');
const { errorResponse } = require('./response');

function geetestVerify(scene) {
    return async (req, res, next) => {
        try {
            // 修复: req.body 可能为 undefined,添加空值保护
            const { geetest_challenge, geetest_validate, geetest_seccode } = req.body || {};
            if (!geetest_challenge || !geetest_validate || !geetest_seccode) {
                return errorResponse(res, '请完成验证码验证', 400);
            }

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
            console.error('验证码验证异常:', error);
            return errorResponse(res, '验证码服务异常', 500);
        }
    };
}

module.exports = { geetestVerify };

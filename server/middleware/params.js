/**
 * 路由参数处理中间件
 * 统一处理路由参数的类型转换
 */

function normalizeParams(paramNames) {
    return (req, res, next) => {
        paramNames.forEach(param => {
            if (req.params[param] !== undefined) {
                if (param.includes('Id')) {
                    req.params[param] = String(req.params[param]);
                }
            }
        });
        next();
    };
}

module.exports = { normalizeParams };

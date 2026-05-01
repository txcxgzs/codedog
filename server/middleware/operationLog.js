/**
 * 操作日志中间件
 */

const { OperationLog } = require('../models');

/**
 * 记录操作日志
 */
async function logOperation(req, action, targetType = null, targetId = null, details = null) {
    try {
        await OperationLog.create({
            user_id: req.user?.id || null,
            action,
            target_type: targetType,
            target_id: targetId,
            details: details ? JSON.stringify(details) : null,
            ip_address: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            user_agent: req.headers['user-agent']
        });
    } catch (error) {
        console.error('记录操作日志错误:', error);
    }
}

/**
 * 操作日志中间件工厂函数
 */
function logAction(action, getTargetType = null, getTargetId = null, getDetails = null) {
    return async (req, res, next) => {
        const originalJson = res.json.bind(res);
        
        res.json = (data) => {
            if (data.code === 200 || data.code === 200) {
                const targetType = getTargetType ? getTargetType(req) : null;
                const targetId = getTargetId ? getTargetId(req, data) : null;
                const details = getDetails ? getDetails(req, data) : null;
                
                logOperation(req, action, targetType, targetId, details);
            }
            return originalJson(data);
        };
        
        next();
    };
}

module.exports = {
    logOperation,
    logAction
};

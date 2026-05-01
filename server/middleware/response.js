/**
 * 统一响应格式中间件
 * 为所有响应提供统一的格式
 */

// 响应成功
function successResponse(res, data = null, msg = '操作成功') {
    return res.json({
        code: 200,
        msg: msg,
        data: data
    });
}

// 响应失败
function errorResponse(res, msg = '操作失败', statusCode = 400, errorCode = null) {
    const response = {
        code: statusCode,
        msg: msg,
        data: null
    };
    if (errorCode) {
        response.errorCode = errorCode;
    }
    return res.status(statusCode).json(response);
}

// 分页响应
function paginateResponse(res, list, total, page, pageSize) {
    return res.json({
        code: 200,
        msg: '获取成功',
        data: {
            list: list,
            pagination: {
                total: total,
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                totalPages: Math.ceil(total / pageSize)
            }
        }
    });
}

module.exports = { successResponse, errorResponse, paginateResponse };

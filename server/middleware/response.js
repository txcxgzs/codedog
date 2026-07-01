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
    // 修复(Report4 #19): total 可能是数组(GROUP BY 聚合返回)、undefined 或非数字,
    // 直接 Math.ceil(total/pageSize) 会得到 NaN,导致前端 totalPages/分页逻辑失效。
    // 先归一化为有限数字:
    //   - 数组:用长度作为总数(典型来自 group + count 的聚合结果)
    //   - 其它:强制 Number,失败(NaN/undefined)回退 0
    // page/pageSize 同样防 NaN:非正数或非数字回退默认值。
    const normalizedTotal = Array.isArray(total) ? total.length : (Number(total) || 0);
    const normalizedPage = Number(page) > 0 ? Math.floor(Number(page)) : 1;
    const normalizedPageSize = Number(pageSize) > 0 ? Math.floor(Number(pageSize)) : 20;
    // 确保 totalPages 始终是有限整数,绝不出现 NaN
    const totalPages = (normalizedPageSize > 0 && Number.isFinite(normalizedTotal))
        ? Math.ceil(normalizedTotal / normalizedPageSize)
        : 0;

    return res.json({
        code: 200,
        msg: '获取成功',
        data: {
            list: list,
            total: normalizedTotal,
            page: normalizedPage,
            pageSize: normalizedPageSize,
            totalPages,
            pagination: {
                total: normalizedTotal,
                page: normalizedPage,
                pageSize: normalizedPageSize,
                totalPages
            }
        }
    });
}

module.exports = { successResponse, errorResponse, paginateResponse };

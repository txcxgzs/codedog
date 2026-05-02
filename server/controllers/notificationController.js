const DbAdapter = require('../utils/dbAdapter');

const { Notification, User, Work, Comment, Post } = require('../models');
const { successResponse, errorResponse, paginateResponse } = require('../middleware/response');

/**
 * 获取通知列表
 */
async function getNotifications(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const type = req.query.type;
        const unreadOnly = req.query.unread === 'true';
        
        const where = { user_id: DbAdapter.getId(req.user) };
        if (type) where.type = type;
        if (unreadOnly) where.is_read = false;
        
        const { count, rows } = await DbAdapter.findAndCountAll(Notification, {
            where,
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
            include: [
                { model: User, as: 'sender', attributes: ['id', 'username', 'nickname', 'avatar'] }
            ]
        });
        
        return paginateResponse(res, rows, count, page, pageSize);
    } catch (error) {
        console.error('获取通知错误:', error);
        return errorResponse(res, '获取通知失败', 500);
    }
}

/**
 * 获取未读数量
 */
async function getUnreadCount(req, res) {
    try {
        const count = await DbAdapter.count(Notification, {
            where: { user_id: DbAdapter.getId(req.user), is_read: false }
        });
        
        return successResponse(res, { count });
    } catch (error) {
        console.error('获取未读数量错误:', error);
        return errorResponse(res, '获取失败', 500);
    }
}

/**
 * 标记为已读
 */
async function markAsRead(req, res) {
    try {
        const { id } = req.params;
        
        const notification = await DbAdapter.findOne(Notification, {
            where: { id, user_id: DbAdapter.getId(req.user) }
        });
        
        if (!notification) {
            return errorResponse(res, '通知不存在', 404);
        }
        
        await DbAdapter.update(Notification, { is_read: true }, { where: { id: DbAdapter.getId(notification) } });
        
        return successResponse(res, null, '已标记为已读');
    } catch (error) {
        console.error('标记已读错误:', error);
        return errorResponse(res, '操作失败', 500);
    }
}

/**
 * 全部标记为已读
 */
async function markAllAsRead(req, res) {
    try {
        await DbAdapter.update(Notification,
            { is_read: true },
            { where: { user_id: DbAdapter.getId(req.user), is_read: false } }
        );
        
        return successResponse(res, null, '已全部标记为已读');
    } catch (error) {
        console.error('全部标记已读错误:', error);
        return errorResponse(res, '操作失败', 500);
    }
}

/**
 * 删除通知
 */
async function deleteNotification(req, res) {
    try {
        const { id } = req.params;
        
        const notification = await DbAdapter.findOne(Notification, {
            where: { id, user_id: DbAdapter.getId(req.user) }
        });
        
        if (!notification) {
            return errorResponse(res, '通知不存在', 404);
        }
        
        await DbAdapter.destroy(Notification, { where: { id: DbAdapter.getId(notification) } });
        
        return successResponse(res, null, '删除成功');
    } catch (error) {
        console.error('删除通知错误:', error);
        return errorResponse(res, '删除失败', 500);
    }
}

/**
 * 清空所有通知
 */
async function clearAll(req, res) {
    try {
        await DbAdapter.destroy(Notification, {
            where: { user_id: DbAdapter.getId(req.user) }
        });
        
        return successResponse(res, null, '已清空所有通知');
    } catch (error) {
        console.error('清空通知错误:', error);
        return errorResponse(res, '操作失败', 500);
    }
}

/**
 * 创建通知（内部函数）
 */
async function createNotification(data) {
    try {
        const notification = await DbAdapter.create(Notification, data);
        return notification;
    } catch (error) {
        console.error('创建通知错误:', error);
        return null;
    }
}

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    createNotification
};

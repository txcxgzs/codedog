/**
 * 消息通知API
 */

import request from './request'

export const notificationApi = {
  getNotifications(params = {}) {
    return request.get('/notifications', { params })
  },
  
  getUnreadCount() {
    return request.get('/notifications/unread-count')
  },
  
  markAsRead(id) {
    return request.put(`/notifications/${id}/read`)
  },
  
  markAllAsRead() {
    return request.put('/notifications/read-all')
  },
  
  deleteNotification(id) {
    return request.delete(`/notifications/${id}`)
  },
  
  clearAll() {
    return request.delete('/notifications/clear/all')
  }
}

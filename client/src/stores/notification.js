/**
 * 通知状态管理
 */

import { defineStore } from 'pinia'
import { notificationApi } from '@/api/notification'

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    unreadCount: 0,
    notifications: [],
    loading: false
  }),
  
  actions: {
    async fetchUnreadCount() {
      try {
        const res = await notificationApi.getUnreadCount()
        if (res.code === 200) {
          this.unreadCount = res.data.count
        }
      } catch (e) {
        console.error('获取未读数量失败:', e)
      }
    },
    
    async fetchNotifications(params = {}) {
      this.loading = true
      try {
        const res = await notificationApi.getNotifications(params)
        if (res.code === 200) {
          this.notifications = res.data.list
          return res.data
        }
      } catch (e) {
        console.error('获取通知失败:', e)
      } finally {
        this.loading = false
      }
    },
    
    async markAsRead(id) {
      try {
        const res = await notificationApi.markAsRead(id)
        if (res.code === 200) {
          this.unreadCount = Math.max(0, this.unreadCount - 1)
          const notification = this.notifications.find(n => n.id === id)
          if (notification) notification.is_read = true
        }
      } catch (e) {
        console.error('标记已读失败:', e)
      }
    },
    
    async markAllAsRead() {
      try {
        const res = await notificationApi.markAllAsRead()
        if (res.code === 200) {
          this.unreadCount = 0
          this.notifications.forEach(n => n.is_read = true)
        }
      } catch (e) {
        console.error('全部标记已读失败:', e)
      }
    },
    
    async deleteNotification(id) {
      try {
        const res = await notificationApi.deleteNotification(id)
        if (res.code === 200) {
          const index = this.notifications.findIndex(n => n.id === id)
          if (index > -1) {
            const notification = this.notifications[index]
            if (!notification.is_read) {
              this.unreadCount = Math.max(0, this.unreadCount - 1)
            }
            this.notifications.splice(index, 1)
          }
        }
      } catch (e) {
        console.error('删除通知失败:', e)
      }
    },
    
    async clearAll() {
      try {
        const res = await notificationApi.clearAll()
        if (res.code === 200) {
          this.notifications = []
          this.unreadCount = 0
        }
      } catch (e) {
        console.error('清空通知失败:', e)
      }
    },
    
    decrementUnread() {
      this.unreadCount = Math.max(0, this.unreadCount - 1)
    },
    
    incrementUnread() {
      this.unreadCount++
    }
  }
})

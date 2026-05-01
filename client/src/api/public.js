/**
 * 公开内容API
 */

import request from './request'

export const publicApi = {
  /**
   * 获取公告列表
   */
  getAnnouncements() {
    return request.get('/public/announcements')
  },
  
  /**
   * 获取轮播图列表
   */
  getBanners() {
    return request.get('/public/banners')
  },
  
  /**
   * 获取活跃用户列表
   */
  getActiveUsers() {
    return request.get('/public/active-users')
  }
}

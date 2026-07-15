/**
 * 公开内容API
 */

import request from './request'

export const publicApi = {
  /** 记录一次页面浏览，IP 由服务端读取并匿名化 */
  recordVisit() {
    return request.post('/public/visit')
  },

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

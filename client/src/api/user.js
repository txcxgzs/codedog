/**
 * 用户相关API
 * 仅支持编程猫账号登录
 */

import request from './request'

export const userApi = {
  /**
   * 用户登录（仅支持编程猫账号）
   */
  login(username, password, geetestData = {}) {
    return request.post('/users/login', { username, password, ...geetestData })
  },
  
  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    return request.get('/users/me')
  },

  getPendingWarning() {
    return request.get('/users/me/pending-warning')
  },

  acknowledgeWarning(warningId, data) {
    return request.post(`/users/me/warnings/${warningId}/acknowledge`, data)
  },

  /**
   * 退出登录
   * 后端会清除 httpOnly cookie
   */
  logout() {
    return request.post('/users/logout')
  },
  
  /**
   * 更新用户资料
   */
  updateProfile(data) {
    return request.put('/users/profile', data)
  },
  
  /**
   * 更新头像
   * 注意：与 updateProfile 共用 /users/profile 接口
   * 后端通过 Content-Type（multipart/form-data）自动区分是头像上传还是普通资料更新
   */
  updateAvatar(formData) {
    return request.put('/users/profile', formData)
  },
  
  /**
   * 通过编程猫用户ID获取用户信息
   */
  getUserById(codemaoId) {
    return request.get(`/users/${codemaoId}`)
  },
  
  /**
   * 通过本地ID获取用户（内部使用）
   */
  getUserByLocalId(id) {
    return request.get(`/users/local/${id}`)
  }
}

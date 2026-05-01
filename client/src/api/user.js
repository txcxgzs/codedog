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
  
  /**
   * 更新用户资料
   */
  updateProfile(data) {
    return request.put('/users/profile', data)
  },
  
  /**
   * 更新头像
   */
  updateAvatar(formData) {
    return request.put('/users/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
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

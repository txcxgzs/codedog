/**
 * 用户状态管理
 * 仅支持编程猫账号登录
 */

import { defineStore } from 'pinia'
import { userApi } from '@/api/user'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(null)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => ['reviewer', 'moderator', 'admin', 'superadmin'].includes(user.value?.role))

  /**
   * 登录（仅支持编程猫账号）
   */
  async function login(username, password, geetestData = {}) {
    try {
      const res = await userApi.login(username, password, geetestData)
      if (res.code === 200) {
        token.value = res.data.token
        user.value = res.data.user
        localStorage.setItem('token', res.data.token)
      }
      return res
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  }

  /**
   * 退出登录
   */
  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
  }

  /**
   * 获取当前用户信息
   */
  async function fetchCurrentUser() {
    if (!token.value) return null
    
    try {
      const res = await userApi.getCurrentUser()
      if (res.code === 200) {
        user.value = res.data
        return res.data
      } else {
        logout()
        return null
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      logout()
      return null
    }
  }

  /**
   * 更新用户资料
   */
  async function updateProfile(data) {
    try {
      const res = await userApi.updateProfile(data)
      if (res.code === 200) {
        user.value = { ...user.value, ...res.data }
      }
      return res
    } catch (error) {
      console.error('更新资料失败:', error)
      throw error
    }
  }

  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    fetchCurrentUser,
    updateProfile
  }
})

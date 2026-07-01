/**
 * 用户状态管理
 * 仅支持编程猫账号登录
 */

import { defineStore } from 'pinia'
import { userApi } from '@/api/user'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(sessionStorage.getItem('token') || '')
  const user = ref(null)

  const isLoggedIn = computed(() => !!token.value)
  // isAdmin 仅指代具备后台管理权限的角色（admin/superadmin），不含 reviewer/moderator
  const isAdmin = computed(() => ['admin', 'superadmin'].includes(user.value?.role))
  // isStaff 表示具备审核/版主权限的所有角色（reviewer 及以上），供需要审核员权限的场景使用
  const isStaff = computed(() => ['reviewer', 'moderator', 'admin', 'superadmin'].includes(user.value?.role))

  /**
   * 登录（仅支持编程猫账号）
   */
  async function login(username, password, geetestData = {}) {
    try {
      const res = await userApi.login(username, password, geetestData)
      if (res.code === 200) {
        token.value = res.data.token
        user.value = res.data.user
        sessionStorage.setItem('token', res.data.token)
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
    sessionStorage.removeItem('token')
  }

  /**
   * 获取当前用户信息
   * - 401 认证失败：清除登录态并返回 null（不抛错，由调用方决定后续行为）
   * - 网络错误等：抛出 error，让路由守卫 catch 后能感知失败（避免守卫中死代码）
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
      // 仅在 401 认证失败时清除登录状态，网络错误不清除 store
      if (error?.response?.status === 401) {
        logout()
        return null
      }
      // 非认证错误（如网络异常）向上抛出，便于路由守卫感知失败并阻止导航
      throw error
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
    isStaff,
    login,
    logout,
    fetchCurrentUser,
    updateProfile
  }
})

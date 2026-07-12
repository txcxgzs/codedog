/**
 * 用户状态管理
 * 仅支持编程猫账号登录
 *
 * 安全更新: token 改用 httpOnly cookie(后端 set-cookie)
 * - 前端不再读取/存储 token 实际值
 * - 浏览器自动随同源请求携带
 * - XSS 无法通过 document.cookie 偷取
 *
 * 兼容旧版: token 字段保留为"已登录标志"(非空字符串即已登录),
 * 旧版 sessionStorage 的 token 仍能驱动请求(后端中间件优先读 cookie, 后备读 header)
 */

import { defineStore } from 'pinia'
import { userApi } from '@/api/user'
import { ref, computed } from 'vue'

// 已登录标志(非空即代表有 token,不存实际值)
const SESSION_FLAG = 'cookie-session' // 仅作占位,告诉前端"已登录"

export const useUserStore = defineStore('user', () => {
  // httpOnly cookie 模式下,cookie 由浏览器自动携带,前端无需管理 token 值
  // token 字段仅作"已通过身份验证"的标志位
  const token = ref('')
  const user = ref(null)

  const isLoggedIn = computed(() => !!token.value || !!user.value)
  // isAdmin 仅指代具备后台管理权限的角色（admin/superadmin），不含 reviewer/moderator
  const isAdmin = computed(() => ['admin', 'superadmin'].includes(user.value?.role))
  // isStaff 表示具备审核/版主权限的所有角色（reviewer 及以上），供需要审核员权限的场景使用
  const isStaff = computed(() => ['reviewer', 'moderator', 'admin', 'superadmin'].includes(user.value?.role))

  /**
   * 登录（仅支持编程猫账号）
   * 后端会同时返回 Set-Cookie 头写入 httpOnly cookie
   */
  async function login(username, password, geetestData = {}) {
    try {
      const res = await userApi.login(username, password, geetestData)
      if (res.code === 200) {
        user.value = res.data.user
        // 修复: token 已由后端写入 cookie, 前端只设置标志位
        token.value = SESSION_FLAG
        // 兼容: 清掉旧版残留的 sessionStorage token, 强制走 cookie 路径
        sessionStorage.removeItem('token')
        // 修复: 清掉 impersonate 残留的 admin_token 标志,避免手动登录后"恢复管理员"按钮仍显示
        sessionStorage.removeItem('admin_token')
      }
      return res
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  }

  /**
   * 退出登录
   * 修复: 调用后端 /users/logout 清除 httpOnly cookie, 并通知后端撤销 token
   */
  async function logout() {
    try {
      // 调用后端清 cookie + 登出, 失败不阻塞本地清理
      await userApi.logout().catch(() => {})
    } catch (_) {
      // 静默失败
    }
    token.value = ''
    user.value = null
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('admin_token')
  }

  /**
   * 获取当前用户信息
   * 修复: httpOnly cookie 模式下,前端无 token 可判,必须先调 /users/me 验证 cookie 是否有效
   * - cookie 有效 → 返回用户信息,设置登录标志
   * - cookie 无效/过期(401) → 清除本地状态,返回 null
   * - 网络错误 → 抛出 error,让路由守卫感知
   */
  async function fetchCurrentUser() {
    // 已有用户信息时无需重复请求
    if (user.value) return user.value

    try {
      const res = await userApi.getCurrentUser()
      if (res.code === 200) {
        user.value = res.data
        token.value = SESSION_FLAG
        return res.data
      } else {
        // 非 200 视为未认证
        token.value = ''
        user.value = null
        return null
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      // 401 认证失败:清除本地状态
      if (error?.response?.status === 401) {
        token.value = ''
        user.value = null
        return null
      }
      // 非认证错误(网络异常等)向上抛出,便于路由守卫感知失败并阻止导航
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

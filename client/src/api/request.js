/**
 * Axios 请求封装
 * 统一处理请求和响应：
 * - baseURL 通过环境变量配置，默认 /api
 * - 401 自动清登录态并跳转登录页（带防抖避免并发重复弹窗）
 * - HCAPTCHA_REQUIRED 派发全局事件，由 App.vue 弹出验证码对话框
 */

import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  // 优先使用 Vite 环境变量，便于不同部署环境（Docker/宝塔）灵活配置后端地址
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  // 修复: 全局默认 30s,避免短操作(登录/统计)在后端异常时卡死 2 分钟;AI 审核等长操作在调用处单独覆盖
  timeout: 30000,
  withCredentials: true
})

let hcaptchaChecking = false
// 401 防抖标记，避免并发请求同时返回 401 时重复弹窗/跳转
let isHandling401 = false

request.interceptors.request.use(
  config => {
    // 修复: token 改用 httpOnly cookie(后端自动通过 Set-Cookie 下发)
    // 浏览器自动随同源请求携带,前端无需手动管理 Authorization 头
    // 兼容: 如果用户还在用旧版本(sessionStorage 有 token),仍可工作
    const token = sessionStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    console.error('响应错误:', error)

    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.msg || '请求失败'
      const errorCode = error.response.data?.errorCode || error.response.data?.code
      const url = error.config?.url || ''

      if (errorCode === 'HCAPTCHA_REQUIRED') {
        if (!hcaptchaChecking) {
          hcaptchaChecking = true
          window.dispatchEvent(new CustomEvent('hcaptcha-required'))
          setTimeout(() => { hcaptchaChecking = false }, 5000)
        }
        return Promise.reject(error)
      }

      if (status === 401) {
        // /login、/register、/auth/me、/users/me 等路径的 401 由调用方自行处理
        const skipRedirectPaths = ['/login', '/register', '/users/me', '/auth/me']
        const shouldSkip = skipRedirectPaths.some(p => url.includes(p))

        if (!shouldSkip) {
          // 防抖：首个 401 处理跳转，其余 401 直接 reject 不重复弹窗/跳转
          if (!isHandling401) {
            isHandling401 = true
            ElMessage.error('登录已过期，请重新登录')
            // 清除 sessionStorage 中的 token
            sessionStorage.removeItem('token')
            // 使用 location.href 跳转，避免在拦截器中引入 router 实例导致循环依赖
            // 同时拼接 redirect 参数，登录后可回到原页面（排除 /login 自身避免死循环）
            const currentPath = window.location.pathname
            const redirect = currentPath && currentPath !== '/login' ? currentPath : '/'
            setTimeout(() => {
              window.location.href = '/login?redirect=' + encodeURIComponent(redirect)
            }, 500)
          }
        }
      } else if (status === 403) {
        if (!url.includes('/hcaptcha/')) {
          ElMessage.error(message || '权限不足')
        }
      } else if (status === 404) {
        ElMessage.error('请求的资源不存在')
      } else if (status === 500) {
        ElMessage.error('服务器错误')
      } else {
        if (!url.includes('/hcaptcha/')) {
          ElMessage.error(message)
        }
      }
    } else {
      ElMessage.error('网络错误，请检查网络连接')
    }

    return Promise.reject(error)
  }
)

export default request

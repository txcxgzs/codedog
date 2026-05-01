/**
 * Axios请求封装
 * 统一处理请求和响应
 */

import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true
})

let hcaptchaChecking = false

request.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
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
      const errorCode = error.response.data?.code
      const url = error.config?.url || ''
      
      if (errorCode === 'HCAPTCHA_REQUIRED') {
        if (!hcaptchaChecking) {
          hcaptchaChecking = true
          window.dispatchEvent(new CustomEvent('hcaptcha-required'))
          setTimeout(() => { hcaptchaChecking = false }, 2000)
        }
        return Promise.reject(error)
      }
      
      if (status === 401 && !url.includes('/login') && !url.includes('/register')) {
        ElMessage.error('登录已过期，请重新登录')
        localStorage.removeItem('token')
        window.location.href = '/login'
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

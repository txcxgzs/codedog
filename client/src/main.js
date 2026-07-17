/**
 * Vue应用入口文件
 * 创建Vue实例，配置插件和全局组件
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import './styles/main.scss'
import './styles/mobile.scss'

const reloadAfterStaleAsset = () => {
  const retryKey = 'codedog_asset_reload_at'
  const lastRetry = Number(sessionStorage.getItem(retryKey) || 0)
  if (Date.now() - lastRetry < 15000) return
  sessionStorage.setItem(retryKey, String(Date.now()))
  const url = new URL(window.location.href)
  url.searchParams.set('__refresh', String(Date.now()))
  window.location.replace(url.toString())
}

// Vite 在异步 JS 或其 CSS 预加载失败时触发该事件。更新切换镜像后自动换取新入口。
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadAfterStaleAsset()
})

// 创建Vue应用
const app = createApp(App)

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 使用插件
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 全局错误处理器：捕获组件渲染/生命周期中的异常，避免白屏无提示
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue 错误:', err, info)
  // 生产环境可在此上报到监控服务（如 Sentry）
}
// 捕获未处理的 Promise rejection，避免静默失败
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 错误:', event.reason)
})

// 挂载应用
app.mount('#app')

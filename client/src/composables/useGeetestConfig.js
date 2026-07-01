/**
 * 极验（Geetest）配置 composable
 * 使用模块级 Promise 缓存解决并发竞态：多个组件同时调用 fetchGeetestConfig 时只发起一次请求
 * 移除 onMounted 自动调用，由调用方根据需要自行触发（避免在不需要验证码的页面也发请求）
 */
import { ref } from 'vue'
import { geetestApi } from '@/api/geetest'

const config = ref({
  enabled: false,
  captcha_id: '',
  product: 'popup',
  scenes: {}
})

let loaded = false
// 模块级 Promise 缓存：并发调用时复用同一个 in-flight Promise，避免重复请求
let configPromise = null

export function useGeetestConfig() {
  const fetchGeetestConfig = async () => {
    // 已加载完成直接返回当前配置
    if (loaded) return config.value
    // 已有请求进行中，复用该 Promise
    if (configPromise) return configPromise
    configPromise = (async () => {
      try {
        const res = await geetestApi.getConfig()
        if (res.code === 200) {
          config.value = res.data
          loaded = true
        }
      } catch (e) {
        console.error('获取验证码配置失败:', e)
      } finally {
        // 无论成功失败都清空 in-flight 标记，允许后续重试
        configPromise = null
      }
      return config.value
    })()
    return configPromise
  }

  const geetestEnabled = (scene) => {
    if (!config.value.enabled) return false
    if (!scene) return config.value.enabled
    return config.value.scenes?.[scene] === true
  }

  return {
    config,
    fetchGeetestConfig,
    geetestEnabled
  }
}

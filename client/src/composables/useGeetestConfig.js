import { ref, onMounted } from 'vue'
import { geetestApi } from '@/api/geetest'

const config = ref({
  enabled: false,
  captcha_id: '',
  product: 'popup',
  scenes: {}
})

let loaded = false

export function useGeetestConfig() {
  const fetchGeetestConfig = async () => {
    if (loaded) return
    try {
      const res = await geetestApi.getConfig()
      if (res.code === 200) {
        config.value = res.data
        loaded = true
      }
    } catch (e) {
      console.error('获取验证码配置失败:', e)
    }
  }

  const geetestEnabled = (scene) => {
    if (!config.value.enabled) return false
    if (!scene) return config.value.enabled
    return config.value.scenes?.[scene] === true
  }

  onMounted(() => {
    fetchGeetestConfig()
  })

  return {
    config,
    fetchGeetestConfig,
    geetestEnabled
  }
}

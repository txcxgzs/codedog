<template>
  <el-dialog
    v-model="visible"
    title="安全验证"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    center
  >
    <div class="hcaptcha-dialog--content">
      <p class="hcaptcha-dialog--tip">为保障安全，在紧急情况，我们会开启此验证。加载较慢耐心等待。</p>
      <div ref="captchaContainer" class="hcaptcha-dialog--captcha"></div>
      <p v-if="error" class="hcaptcha-dialog--error">{{ error }}</p>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { hcaptchaApi } from '@/api/hcaptcha'
import { ElMessage } from 'element-plus'

const visible = ref(false)
const captchaContainer = ref(null)
const error = ref('')
const siteKey = ref('')
const widgetId = ref(null)
const resolvePromise = ref(null)
const currentScene = ref('')

const loadScript = () => {
  return new Promise((resolve, reject) => {
    if (window.hcaptcha) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.hcaptcha.com/1/api.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('hCaptcha脚本加载失败'))
    document.head.appendChild(script)
  })
}

const show = async (sceneName) => {
  error.value = ''
  currentScene.value = sceneName || 'global'
  visible.value = true
  
  try {
    const configRes = await hcaptchaApi.getConfig()
    if (configRes.code !== 200 || !configRes.data.enabled) {
      visible.value = false
      return null
    }
    
    siteKey.value = configRes.data.site_key
    await loadScript()
    
    try {
      await hcaptchaApi.recordShow(currentScene.value)
    } catch (e) {
      console.error('记录hCaptcha展示失败:', e)
    }
    
    if (captchaContainer.value) {
      captchaContainer.value.innerHTML = ''
      
      widgetId.value = window.hcaptcha.render(captchaContainer.value, {
        sitekey: siteKey.value,
        callback: onVerify,
        'error-callback': onError
      })
    }
  } catch (e) {
    console.error('hCaptcha加载失败:', e)
    error.value = '验证码加载失败，请刷新重试'
  }
  
  return new Promise((resolve) => {
    resolvePromise.value = resolve
  })
}

const onVerify = async (token) => {
  try {
    const res = await hcaptchaApi.verify(token, currentScene.value)
    if (res.code === 200) {
      visible.value = false
      if (resolvePromise.value) {
        resolvePromise.value({ verified: true, expires_at: res.data.expires_at })
        resolvePromise.value = null
      }
    } else {
      error.value = res.msg || '验证失败'
      if (window.hcaptcha && widgetId.value !== null) {
        window.hcaptcha.reset(widgetId.value)
      }
    }
  } catch (e) {
    error.value = '验证失败，请重试'
    if (window.hcaptcha && widgetId.value !== null) {
      window.hcaptcha.reset(widgetId.value)
    }
  }
}

const onError = () => {
  error.value = '验证出错，请重试'
}

defineExpose({ show })
</script>

<style lang="scss" scoped>
.hcaptcha-dialog {
  &--content {
    text-align: center;
    padding: 20px 0;
  }
  
  &--tip {
    color: #666;
    margin-bottom: 20px;
  }
  
  &--captcha {
    display: flex;
    justify-content: center;
    min-height: 78px;
  }
  
  &--error {
    color: #f56c6c;
    margin-top: 15px;
    font-size: 14px;
  }
}
</style>

<template>
  <el-dialog
    v-model="visible"
    title="安全验证"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    center
    @closed="handleClosed"
  >
    <div class="hcaptcha-dialog--content">
      <p class="hcaptcha-dialog--tip">当前需要完成安全验证后继续操作。</p>
      <div ref="captchaContainer" class="hcaptcha-dialog--captcha"></div>
      <p v-if="error" class="hcaptcha-dialog--error">{{ error }}</p>
    </div>

    <template #footer>
      <el-button @click="cancel">取消</el-button>
      <el-button v-if="error" type="primary" @click="retry">重试</el-button>
    </template>
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

    const existing = document.querySelector('script[data-hcaptcha-loader="true"]')
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', () => reject(new Error('hCaptcha 脚本加载失败')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://js.hcaptcha.com/1/api.js'
    script.async = true
    script.defer = true
    script.dataset.hcaptchaLoader = 'true'
    script.onload = resolve
    script.onerror = () => reject(new Error('hCaptcha 脚本加载失败'))
    document.head.appendChild(script)
  })
}

const settle = (result) => {
  const resolve = resolvePromise.value
  resolvePromise.value = null
  visible.value = false
  if (resolve) resolve(result)
}

const renderCaptcha = async () => {
  const configRes = await hcaptchaApi.getConfig()
  if (configRes.code !== 200 || !configRes.data.enabled) {
    settle(null)
    return
  }

  siteKey.value = configRes.data.site_key
  if (!siteKey.value) {
    throw new Error('hCaptcha site key 未配置')
  }

  await loadScript()

  try {
    await hcaptchaApi.recordShow(currentScene.value)
  } catch (e) {
    console.error('记录 hCaptcha 展示失败:', e)
  }

  if (captchaContainer.value) {
    captchaContainer.value.innerHTML = ''
    widgetId.value = window.hcaptcha.render(captchaContainer.value, {
      sitekey: siteKey.value,
      callback: onVerify,
      'error-callback': onError
    })
  }
}

const show = (sceneName) => {
  currentScene.value = sceneName || 'global'
  error.value = ''
  visible.value = true

  return new Promise((resolve) => {
    resolvePromise.value = resolve
    renderCaptcha().catch((e) => {
      console.error('hCaptcha 加载失败:', e)
      error.value = e.message || '验证码加载失败，请重试'
      ElMessage.error(error.value)
      settle({ verified: false, error: error.value })
    })
  })
}

const retry = () => {
  error.value = ''
  renderCaptcha().catch((e) => {
    error.value = e.message || '验证码加载失败，请重试'
    ElMessage.error(error.value)
    settle({ verified: false, error: error.value })
  })
}

const cancel = () => {
  settle({ verified: false, cancelled: true })
}

const handleClosed = () => {
  if (resolvePromise.value) {
    settle({ verified: false, cancelled: true })
  }
}

const onVerify = async (token) => {
  try {
    const res = await hcaptchaApi.verify(token, currentScene.value)
    if (res.code === 200) {
      settle({ verified: true, expires_at: res.data.expires_at })
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

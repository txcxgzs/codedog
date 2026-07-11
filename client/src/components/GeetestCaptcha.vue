<template>
  <div class="geetest-captcha">
    <div ref="captchaBox" class="geetest-captcha--box"></div>
    <div v-if="loading" class="geetest-captcha--loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载验证码...</span>
    </div>
    <div v-if="error" class="geetest-captcha--error">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ error }}</span>
      <el-button size="small" text @click="init">重试</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { geetestApi } from '@/api/geetest'
import { Loading, WarningFilled } from '@element-plus/icons-vue'

const props = defineProps({
  scene: { type: String, default: 'login' }
})

const emit = defineEmits(['success', 'error', 'ready'])

const captchaBox = ref(null)
const loading = ref(false)
const error = ref('')
const captchaObj = ref(null)
const validated = ref(false)
const validateData = ref(null)
const config = ref(null)

const init = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const configRes = await geetestApi.getConfig()
    if (configRes.code !== 200 || !configRes.data.enabled) {
      emit('ready', { enabled: false })
      loading.value = false
      return
    }
    
    config.value = configRes.data
    
    // 检查该场景是否需要验证
    if (!configRes.data.scenes[props.scene]) {
      emit('ready', { enabled: false })
      loading.value = false
      return
    }
    
    const registerRes = await geetestApi.register()
    if (registerRes.code !== 200) {
      throw new Error('验证码注册失败')
    }
    
    const { gt, challenge, success, new_captcha } = registerRes.data
    const product = configRes.data.product || 'popup'
    
    if (!window.initGeetest) {
      const script = document.createElement('script')
      script.src = 'https://static.geetest.com/static/js/gt.0.5.0.js'
      script.onload = () => loadCaptcha(gt, challenge, success, new_captcha, product)
      script.onerror = () => {
        error.value = '验证码脚本加载失败'
        loading.value = false
        // 修复: 脚本加载失败时通知父组件禁用验证码,否则用户无法通过登录验证
        emit('ready', { enabled: false })
      }
      document.head.appendChild(script)
    } else {
      loadCaptcha(gt, challenge, success, new_captcha, product)
    }
  } catch (e) {
    error.value = e.message || '验证码初始化失败'
    loading.value = false
    // 修复: 初始化失败时也通知父组件禁用验证码,否则用户无法通过登录验证
    emit('ready', { enabled: false })
    emit('error', e)
  }
}

const loadCaptcha = async (gt, challenge, offline, newCaptcha, product) => {
  try {
    await geetestApi.recordShow(props.scene)
  } catch (e) {
    console.error('记录验证码展示失败:', e)
  }
  
  window.initGeetest({
    gt,
    challenge,
    offline: !offline,
    new_captcha: newCaptcha,
    product: product,
    width: '100%'
  }, (captcha) => {
    captchaObj.value = captcha
    
    // 修复: 检查 DOM ref 是否存在,避免组件卸载后 appendTo(null) 抛错
    if (captchaBox.value) {
      captcha.appendTo(captchaBox.value)
    }
    
    captcha.onReady(() => {
      loading.value = false
      emit('ready', { enabled: true, product })
    })
    
    captcha.onSuccess(() => {
      const result = captcha.getValidate()
      if (result) {
        validateData.value = {
          geetest_challenge: result.geetest_challenge,
          geetest_validate: result.geetest_validate,
          geetest_seccode: result.geetest_seccode
        }
        validated.value = true
        emit('success', validateData.value)
      }
    })
    
    captcha.onError(() => {
      error.value = '验证码加载出错'
      loading.value = false
      emit('error', new Error('验证码加载出错'))
    })
    
    captcha.onClose(() => {
      validated.value = false
      validateData.value = null
    })
  })
}

const getValidateData = () => {
  return validateData.value
}

const reset = () => {
  if (captchaObj.value) {
    captchaObj.value.reset()
    validated.value = false
    validateData.value = null
  }
}

const verify = () => {
  if (captchaObj.value) {
    captchaObj.value.verify()
  }
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  if (captchaObj.value) {
    captchaObj.value.destroy()
  }
})

watch(() => props.scene, () => {
  if (captchaObj.value) {
    captchaObj.value.destroy()
    captchaObj.value = null
  }
  init()
})

defineExpose({
  getValidateData,
  reset,
  verify,
  validated
})
</script>

<style lang="scss">
.geetest-captcha {
  width: 100%;
  
  &--box {
    min-height: 44px;
  }
  
  &--loading,
  &--error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    color: #909399;
    font-size: 14px;
  }
  
  &--error {
    color: #f56c6c;
  }
}
</style>

<template>
  <el-dialog
    v-model="visible"
    title="安全验证"
    width="400px"
    :close-on-click-modal="false"
    destroy-on-close
    @open="onOpen"
  >
    <div v-if="loading" class="geetest-dialog--loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载验证码...</span>
    </div>
    <div v-if="error" class="geetest-dialog--error">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ error }}</span>
      <el-button size="small" text @click="initCaptcha">重试</el-button>
    </div>
    <div ref="captchaBox" class="geetest-dialog--box"></div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { Loading, WarningFilled } from '@element-plus/icons-vue'
import { geetestApi } from '@/api/geetest'

const visible = ref(false)
const captchaBox = ref(null)
const loading = ref(false)
const error = ref('')
const captchaObj = ref(null)
const resolvePromise = ref(null)
const currentScene = ref('')

const onOpen = () => {
  initCaptcha()
}

const initCaptcha = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const configRes = await geetestApi.getConfig()
    if (configRes.code !== 200 || !configRes.data.enabled) {
      if (resolvePromise.value) {
        resolvePromise.value({})
        resolvePromise.value = null
      }
      visible.value = false
      return
    }
    
    if (!configRes.data.scenes[currentScene.value]) {
      if (resolvePromise.value) {
        resolvePromise.value({})
        resolvePromise.value = null
      }
      visible.value = false
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
      }
      document.head.appendChild(script)
    } else {
      loadCaptcha(gt, challenge, success, new_captcha, product)
    }
  } catch (e) {
    error.value = e.message || '验证码初始化失败'
    loading.value = false
  }
}

const loadCaptcha = (gt, challenge, offline, newCaptcha, product) => {
  window.initGeetest({
    gt,
    challenge,
    offline: !offline,
    new_captcha: newCaptcha,
    product: product,
    width: '100%'
  }, (captcha) => {
    captchaObj.value = captcha
    
    captcha.onReady(() => {
      loading.value = false
      if (product === 'bind') {
        captcha.verify()
      }
    })
    
    captcha.onSuccess(() => {
      const result = captcha.getValidate()
      if (result && resolvePromise.value) {
        resolvePromise.value({
          geetest_challenge: result.geetest_challenge,
          geetest_validate: result.geetest_validate,
          geetest_seccode: result.geetest_seccode
        })
        resolvePromise.value = null
      }
      visible.value = false
    })
    
    captcha.onError(() => {
      error.value = '验证码加载出错'
      loading.value = false
    })
    
    if (product !== 'bind') {
      captcha.appendTo(captchaBox.value)
    }
  })
}

const show = async (sceneName) => {
  return new Promise(async (resolve) => {
    currentScene.value = sceneName
    resolvePromise.value = resolve
    
    try {
      const configRes = await geetestApi.getConfig()
      if (configRes.code !== 200 || !configRes.data.enabled) {
        resolve({})
        resolvePromise.value = null
        return
      }
      
      if (!configRes.data.scenes[sceneName]) {
        resolve({})
        resolvePromise.value = null
        return
      }
      
      await geetestApi.recordShow(sceneName)
    } catch (e) {
      console.error('检查验证码配置失败:', e)
    }
    
    visible.value = true
  })
}

defineExpose({
  show
})
</script>

<style lang="scss">
.geetest-dialog {
  &--loading,
  &--error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px;
    color: #909399;
    font-size: 14px;
  }
  
  &--error {
    color: #f56c6c;
  }
  
  &--box {
    min-height: 44px;
  }
}
</style>

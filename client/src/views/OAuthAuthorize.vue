<template>
  <div class="r-oauth--page">
    <div class="r-oauth--card" v-loading="loading">
      <template v-if="errorMsg">
        <el-result icon="error" title="无法完成授权" :sub-title="errorMsg">
          <template #extra>
            <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
          </template>
        </el-result>
      </template>
      <template v-else-if="info">
        <div class="r-oauth--app">
          <img v-if="info.app.logo_url" :src="info.app.logo_url" class="r-oauth--logo" alt="app" />
          <div class="r-oauth--app_fallback" v-else>{{ (info.app.name || 'A').slice(0,1) }}</div>
          <div>
            <h1>{{ info.app.name }}</h1>
            <p class="r-oauth--desc">{{ info.app.description || '申请访问你的编程狗账号数据' }}</p>
          </div>
        </div>

        <el-alert
          :type="riskAlertType"
          :closable="false"
          show-icon
          :title="riskAlertTitle"
        />
        <el-alert
          v-if="info.reauthorization_required"
          class="r-oauth--reauthorize"
          type="warning"
          :closable="false"
          show-icon
          title="该应用申请了新的权限，需要你重新确认授权；未确认前不会获得新增权限。"
        />

        <ul class="r-oauth--scopes">
          <li v-for="s in info.scopes" :key="s.key">
            <b>
              {{ s.name || s.key }}
              <el-tag v-if="s.risk === 'write'" size="small" type="warning">可修改数据</el-tag>
              <el-tag v-else-if="s.risk === 'admin'" size="small" type="danger">管理权限</el-tag>
              <el-tag v-if="s.is_new" size="small" type="warning">新增权限</el-tag>
            </b>
            <span>{{ s.description || s.key }}</span>
          </li>
        </ul>

        <div class="r-oauth--actions">
          <el-button size="large" @click="decide(false)" :loading="submitting">拒绝</el-button>
          <el-button type="primary" size="large" @click="decide(true)" :loading="submitting">允许授权</el-button>
        </div>
        <p class="r-oauth--tip">登录身份：{{ userStore.user?.nickname || userStore.user?.username }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { oauthApi } from '@/api/developer'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const submitting = ref(false)
const info = ref(null)
const errorMsg = ref('')

const hasAdminScope = computed(() => (info.value?.scopes || []).some(s => s.risk === 'admin'))
const hasWriteScope = computed(() => (info.value?.scopes || []).some(s => s.risk === 'write'))
const riskAlertType = computed(() => hasAdminScope.value ? 'error' : (hasWriteScope.value ? 'warning' : 'info'))
const riskAlertTitle = computed(() => {
  if (hasAdminScope.value) return '该应用申请管理权限，授权后可能查看或处理后台数据，请确认应用可信。'
  if (hasWriteScope.value) return '该应用申请写入权限，授权后可以代表你发布、修改或删除数据。'
  return '授权后，该应用将获得以下只读权限：'
})

const loadInfo = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = {
      response_type: route.query.response_type || 'code',
      client_id: route.query.client_id,
      redirect_uri: route.query.redirect_uri,
      scope: route.query.scope,
      state: route.query.state
    }
    if (!params.client_id || !params.redirect_uri) {
      errorMsg.value = '缺少 client_id 或 redirect_uri'
      return
    }
    const res = await oauthApi.getAuthorizeInfo(params)
    if (res.code === 200) {
      info.value = res.data
    } else {
      errorMsg.value = res.msg || '获取授权信息失败'
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.msg || '获取授权信息失败'
  } finally {
    loading.value = false
  }
}

const decide = async (approved) => {
  submitting.value = true
  try {
    const res = await oauthApi.approveAuthorize({
      client_id: route.query.client_id,
      redirect_uri: route.query.redirect_uri,
      scope: route.query.scope,
      state: route.query.state,
      approved
    })
    if (res.code === 200 && res.data?.redirect_to) {
      window.location.href = res.data.redirect_to
      return
    }
    ElMessage.error(res.msg || '操作失败')
  } catch (e) {
    ElMessage.error(e.response?.data?.msg || '操作失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (!userStore.isLoggedIn) {
    router.replace({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  loadInfo()
})
</script>

<style scoped lang="scss">
.r-oauth--page {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: linear-gradient(180deg, #fff9e6 0%, #f7f8fa 40%);
}
.r-oauth--card {
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-radius: 16px;
  padding: 28px 24px;
  box-shadow: 0 8px 28px rgba(0,0,0,.06);
}
.r-oauth--app {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 18px;
  h1 { margin: 0 0 4px; font-size: 20px; }
}
.r-oauth--logo {
  width: 56px; height: 56px; border-radius: 12px; object-fit: cover;
}
.r-oauth--app_fallback {
  width: 56px; height: 56px; border-radius: 12px;
  background: #FEC433; color: #fff; font-size: 24px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.r-oauth--desc { margin: 0; color: #888; font-size: 13px; }
.r-oauth--reauthorize { margin-top: 12px; }
.r-oauth--scopes {
  list-style: none; padding: 0; margin: 16px 0;
  li {
    padding: 10px 12px; border: 1px solid #f0f0f0; border-radius: 8px; margin-bottom: 8px;
    display: flex; flex-direction: column; gap: 2px;
    b { color: #333; font-size: 14px; }
    span { color: #888; font-size: 12px; }
  }
}
.r-oauth--actions {
  display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px;
}
.r-oauth--tip { margin: 14px 0 0; color: #aaa; font-size: 12px; text-align: center; }
</style>

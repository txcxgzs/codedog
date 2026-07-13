<template>
  <div class="r-dev--page">
    <div class="r-dev--container">
      <div class="r-dev--header">
        <div>
          <h1>开发者平台</h1>
          <p class="r-dev--subtitle">创建应用、申请权限，通过 OAuth2 安全读取用户授权数据</p>
        </div>
        <div class="r-dev--header_actions">
          <el-button @click="$router.push('/developer/docs')">接口文档</el-button>
          <el-button type="primary" @click="openCreate">创建应用</el-button>
        </div>
      </div>

      <el-alert
        v-if="secretOnce"
        type="warning"
        show-icon
        :closable="true"
        class="r-dev--secret_alert"
        @close="secretOnce = null"
      >
        <template #title>请立即保存 client_secret（仅展示一次）</template>
        <div class="r-dev--secret_box">
          <div><b>client_id:</b> <code>{{ secretOnce.client_id }}</code></div>
          <div><b>client_secret:</b> <code>{{ secretOnce.client_secret }}</code></div>
          <el-button size="small" @click="copyText(secretOnce.client_secret)">复制 secret</el-button>
        </div>
      </el-alert>

      <el-table :data="apps" v-loading="loading" empty-text="还没有应用，点击右上角创建">
        <el-table-column prop="name" label="应用名称" min-width="140" />
        <el-table-column prop="client_id" label="client_id" min-width="180">
          <template #default="{ row }">
            <code class="r-dev--code">{{ row.client_id }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="权限" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="s in (row.scopes_requested || [])"
              :key="s"
              size="small"
              class="r-dev--scope_tag"
            >{{ s }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="warning" :disabled="row.status !== 'active'" @click="handleRotate(row)">重置密钥</el-button>
            <el-button size="small" type="primary" link @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="dialogVisible" :title="editingId ? '编辑应用' : '创建应用'" width="560px" destroy-on-close>
        <el-form :model="form" label-width="100px">
          <el-form-item label="应用名称" required>
            <el-input v-model="form.name" maxlength="100" show-word-limit placeholder="例如：我的工具" />
          </el-form-item>
          <el-form-item label="简介">
            <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
          </el-form-item>
          <el-form-item label="主页 URL">
            <el-input v-model="form.homepage_url" placeholder="https://..." />
          </el-form-item>
          <el-form-item label="Logo URL">
            <el-input v-model="form.logo_url" placeholder="https://..." />
          </el-form-item>
          <el-form-item label="回调 URL" required>
            <el-input
              v-model="form.redirect_uris_text"
              type="textarea"
              :rows="3"
              placeholder="每行一个回调地址，生产环境需 HTTPS（localhost 可用 HTTP）"
            />
          </el-form-item>
          <el-form-item label="申请权限" required>
            <el-checkbox-group v-model="form.scopes">
              <el-checkbox v-for="s in scopeOptions" :key="s.key" :label="s.key">
                {{ s.name }}（{{ s.key }}）
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-alert
            v-if="editingId"
            type="info"
            :closable="false"
            title="修改回调地址或权限后，应用将重新进入待审核状态"
            style="margin-bottom: 12px"
          />
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
        </template>
      </el-dialog>

      <el-drawer v-model="detailVisible" title="应用详情" size="420px">
        <template v-if="detailApp">
          <p><b>名称：</b>{{ detailApp.name }}</p>
          <p><b>状态：</b>{{ statusText(detailApp.status) }}</p>
          <p v-if="detailApp.review_note"><b>审核备注：</b>{{ detailApp.review_note }}</p>
          <p><b>client_id：</b><code>{{ detailApp.client_id }}</code></p>
          <p><b>回调：</b></p>
          <ul>
            <li v-for="u in (detailApp.redirect_uris || [])" :key="u"><code>{{ u }}</code></li>
          </ul>
          <p><b>权限：</b></p>
          <el-tag v-for="s in (detailApp.scopes_requested || [])" :key="s" size="small" class="r-dev--scope_tag">{{ s }}</el-tag>
          <el-divider />
          <p class="r-dev--hint">授权链接示例：</p>
          <pre class="r-dev--pre">{{ authExample(detailApp) }}</pre>
        </template>
      </el-drawer>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { developerApi } from '@/api/developer'

const apps = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const detailVisible = ref(false)
const detailApp = ref(null)
const editingId = ref(null)
const secretOnce = ref(null)
const scopeOptions = ref([
  { key: 'profile:read', name: '读取资料' },
  { key: 'works:read', name: '读取作品' },
  { key: 'comments:read', name: '读取评论' },
  { key: 'posts:read', name: '读取帖子' }
])

const form = reactive({
  name: '',
  description: '',
  homepage_url: '',
  logo_url: '',
  redirect_uris_text: '',
  scopes: ['profile:read']
})

const statusText = (s) => ({
  pending: '待审核',
  active: '已通过',
  rejected: '已拒绝',
  suspended: '已停用'
}[s] || s)

const statusType = (s) => ({
  pending: 'warning',
  active: 'success',
  rejected: 'danger',
  suspended: 'info'
}[s] || 'info')

const formatDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN')
}

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.info(text)
  }
}

const loadApps = async () => {
  loading.value = true
  try {
    const res = await developerApi.listApps()
    if (res.code === 200) apps.value = res.data || []
    else ElMessage.error(res.msg || '加载失败')
  } catch (e) {
    ElMessage.error(e.response?.data?.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

const loadScopes = async () => {
  try {
    const res = await developerApi.getScopeDocs()
    if (res.code === 200 && Array.isArray(res.data?.scopes)) {
      scopeOptions.value = res.data.scopes
    }
  } catch { /* keep defaults */ }
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.homepage_url = ''
  form.logo_url = ''
  form.redirect_uris_text = ''
  form.scopes = ['profile:read']
  editingId.value = null
}

const openCreate = () => {
  resetForm()
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  form.name = row.name || ''
  form.description = row.description || ''
  form.homepage_url = row.homepage_url || ''
  form.logo_url = row.logo_url || ''
  form.redirect_uris_text = (row.redirect_uris || []).join('\n')
  form.scopes = [...(row.scopes_requested || ['profile:read'])]
  dialogVisible.value = true
}

const showDetail = (row) => {
  detailApp.value = row
  detailVisible.value = true
}

const authExample = (app) => {
  if (!app) return ''
  const redirect = (app.redirect_uris && app.redirect_uris[0]) || 'https://your.app/callback'
  const scope = (app.scopes_requested || ['profile:read']).join(' ')
  return `/oauth/authorize?response_type=code&client_id=${app.client_id}&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scope)}&state=xyz`
}

const submitForm = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请填写应用名称')
    return
  }
  const redirect_uris = form.redirect_uris_text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  if (!redirect_uris.length) {
    ElMessage.warning('请至少填写一个回调 URL')
    return
  }
  if (!form.scopes.length) {
    ElMessage.warning('请至少选择一个权限')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description,
      homepage_url: form.homepage_url,
      logo_url: form.logo_url,
      redirect_uris,
      scopes: form.scopes
    }
    let res
    if (editingId.value) {
      res = await developerApi.updateApp(editingId.value, payload)
    } else {
      res = await developerApi.createApp(payload)
    }
    if (res.code === 200) {
      ElMessage.success(res.msg || '保存成功')
      if (res.data?.client_secret) {
        secretOnce.value = {
          client_id: res.data.client_id,
          client_secret: res.data.client_secret
        }
      }
      dialogVisible.value = false
      await loadApps()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error(e.response?.data?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleRotate = async (row) => {
  try {
    await ElMessageBox.confirm('重置后旧 client_secret 立即失效，确认继续？', '重置密钥', { type: 'warning' })
    const res = await developerApi.rotateSecret(row.id)
    if (res.code === 200 && res.data?.client_secret) {
      secretOnce.value = {
        client_id: res.data.client_id || row.client_id,
        client_secret: res.data.client_secret
      }
      ElMessage.success('密钥已重置，请立即保存')
      await loadApps()
    } else {
      ElMessage.error(res.msg || '重置失败')
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.msg || '重置失败')
  }
}

onMounted(async () => {
  await loadScopes()
  await loadApps()
})
</script>

<style scoped lang="scss">
.r-dev--page {
  min-height: calc(100vh - 64px);
  background: #f7f8fa;
  padding: 24px 16px 48px;
}
.r-dev--container {
  max-width: 1100px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,.04);
}
.r-dev--header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
  h1 { margin: 0 0 6px; font-size: 22px; color: #333; }
}
.r-dev--subtitle { margin: 0; color: #888; font-size: 13px; }
.r-dev--header_actions { display: flex; gap: 8px; flex-wrap: wrap; }
.r-dev--secret_alert { margin-bottom: 16px; }
.r-dev--secret_box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  code { word-break: break-all; background: #fff7e6; padding: 2px 6px; border-radius: 4px; }
}
.r-dev--code { font-size: 12px; word-break: break-all; }
.r-dev--scope_tag { margin: 0 4px 4px 0; }
.r-dev--pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
}
.r-dev--hint { color: #888; font-size: 13px; }
</style>

<template>
  <div class="r-dev--page">
    <div class="r-dev--container">
      <div class="r-dev--header">
        <div>
          <el-button class="r-dev--back_home" text @click="$router.push('/')">← 返回主页</el-button>
          <h1>开发者平台</h1>
          <p class="r-dev--subtitle">创建应用、申请权限，通过 OAuth2 安全读取用户授权数据与审核工作室</p>
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

      <div class="r-dev--apps_panel">
        <div class="r-dev--section_head">
          <div><h2>我的应用</h2><p>管理凭证、权限与接口调用</p></div>
          <span>{{ apps.length }} 个应用</span>
        </div>
      <el-table :data="apps" v-loading="loading" empty-text="还没有应用，点击右上角创建">
        <el-table-column prop="name" label="应用名称" min-width="180">
          <template #default="{ row }"><div class="r-dev--app_name"><el-avatar :size="34" :src="row.logo_url">{{ (row.name || 'A').charAt(0) }}</el-avatar><span>{{ row.name }}</span></div></template>
        </el-table-column>
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
        <el-table-column label="权限" min-width="200">
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
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <el-dialog v-model="dialogVisible" :title="editingId ? '编辑应用' : '创建应用'" width="min(720px, 94vw)" destroy-on-close>
        <el-steps :active="wizardStep" finish-status="success" simple style="margin-bottom:24px"><el-step title="基本信息" /><el-step title="回调地址" /><el-step title="申请权限" /><el-step title="确认提交" /></el-steps>
        <el-form :model="form" class="r-dev--wizard_form" label-position="top">
          <el-form-item v-show="wizardStep === 0" label="应用名称" required>
            <el-input v-model="form.name" maxlength="100" show-word-limit placeholder="例如：我的工具" />
          </el-form-item>
          <el-form-item v-show="wizardStep === 0" label="简介">
            <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
          </el-form-item>
          <el-form-item v-show="wizardStep === 0" label="主页 URL">
            <el-input v-model="form.homepage_url" placeholder="https://..." />
          </el-form-item>
          <el-form-item v-show="wizardStep === 0" label="Logo URL">
            <el-input v-model="form.logo_url" placeholder="https://..." />
            <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp" style="display:none" @change="onLogoSelected" />
            <el-button size="small" style="margin-top:8px" @click="logoInput?.click()">上传图标</el-button><span v-if="logoFile" class="r-dev--upload_hint">{{ logoFile.name }}</span>
          </el-form-item>
          <el-form-item v-show="wizardStep === 1" label="回调 URL" required>
            <el-input
              v-model="form.redirect_uris_text"
              type="textarea"
              :rows="3"
              placeholder="每行一个回调地址，生产环境需 HTTPS（localhost 可用 HTTP）"
            />
          </el-form-item>
          <el-form-item v-show="wizardStep === 2" label="申请权限" required>
            <div class="r-dev--scope_summary">已选择 <b>{{ form.scopes.length }}</b> 项权限；点击分类标题展开选择</div>
            <el-collapse v-model="expandedScopeGroups" class="r-dev--scope_collapse">
              <el-collapse-item v-for="group in scopeGroups" :key="group.key" :name="group.key">
                <template #title>
                  <div class="r-dev--scope_group_title">
                    <b>{{ group.title }}</b>
                    <span>{{ group.description }}</span>
                    <el-tag size="small" round>{{ selectedScopeCount(group) }}/{{ group.items.length }}</el-tag>
                  </div>
                </template>
                <el-checkbox-group v-model="form.scopes" class="r-dev--scope_grid">
                  <el-checkbox v-for="s in group.items" :key="s.key" :label="s.key">
                    <span>{{ s.name }}</span><code>{{ s.key }}</code>
                    <el-tag v-if="s.risk === 'write'" size="small" type="warning">写入</el-tag>
                    <el-tag v-else-if="s.risk === 'admin'" size="small" type="danger">管理</el-tag>
                  </el-checkbox>
                </el-checkbox-group>
              </el-collapse-item>
            </el-collapse>
          </el-form-item>
          <div v-if="wizardStep === 3" class="r-dev--review_box">
            <h3>请确认申请信息</h3>
            <p><b>应用：</b>{{ form.name }}</p><p><b>主页：</b>{{ form.homepage_url || '-' }}</p>
            <p><b>回调地址：</b>{{ form.redirect_uris_text }}</p><p><b>权限：</b>{{ form.scopes.join(', ') }}</p>
          </div>
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
          <el-button v-if="wizardStep > 0" @click="wizardStep--">上一步</el-button>
          <el-button v-if="wizardStep < 3" type="primary" @click="nextWizardStep">下一步</el-button>
          <el-button v-else type="primary" :loading="saving" @click="submitForm">确认提交</el-button>
        </template>
      </el-dialog>

      <el-drawer v-model="detailVisible" title="应用详情" size="560px" class="r-dev--detail_drawer">
        <template v-if="detailApp">
          <p class="r-dev--detail_name"><el-avatar :size="42" :src="detailApp.logo_url">{{ (detailApp.name || 'A').charAt(0) }}</el-avatar><b>{{ detailApp.name }}</b></p>
          <p><b>状态：</b>{{ statusText(detailApp.status) }}</p>
          <p v-if="detailApp.review_note"><b>审核备注：</b>{{ detailApp.review_note }}</p>
          <p><b>client_id：</b><code>{{ detailApp.client_id }}</code></p>
          <p><b>回调：</b></p>
          <ul>
            <li v-for="u in (detailApp.redirect_uris || [])" :key="u"><code>{{ u }}</code></li>
          </ul>
          <p><b>权限：</b></p>
          <el-tag v-for="s in (detailApp.scopes_requested || [])" :key="s" size="small" class="r-dev--scope_tag">{{ s }}</el-tag>
          <div class="r-dev--detail_actions"><el-button size="small" @click="openEdit(detailApp)">编辑应用</el-button><el-button size="small" type="warning" @click="handleRotate(detailApp)">重置密钥</el-button></div>
          <el-divider />
          <p class="r-dev--hint">授权链接示例：</p>
          <pre class="r-dev--pre">{{ authExample(detailApp) }}</pre>
          <el-divider />
          <div class="r-dev--calls_head"><b>API 调用记录</b><el-button size="small" @click="loadCalls(detailApp)">刷新</el-button></div>
          <el-table :data="calls" size="small" v-loading="callsLoading" max-height="300" empty-text="暂无调用记录">
            <el-table-column prop="created_at" label="时间" width="145"><template #default="{ row }">{{ formatDate(row.created_at) }}</template></el-table-column>
            <el-table-column prop="method" label="方法" width="60" />
            <el-table-column prop="path" label="接口" min-width="150" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="60" />
            <el-table-column type="expand" width="36"><template #default="{ row }"><div class="r-dev--payload"><b>请求</b><pre>{{ formatPayload(row.request) }}</pre><b>响应</b><pre>{{ formatPayload(row.response) }}</pre></div></template></el-table-column>
          </el-table>
        </template>
      </el-drawer>
      <GeetestDialog ref="geetestDialogRef" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { developerApi } from '@/api/developer'
import GeetestDialog from '@/components/GeetestDialog.vue'
import { useGeetestConfig } from '@/composables/useGeetestConfig'

const apps = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const detailVisible = ref(false)
const detailApp = ref(null)
const editingId = ref(null)
const secretOnce = ref(null)
const scopeOptions = ref([])
const expandedScopeGroups = ref(['identity'])
const wizardStep = ref(0)
const calls = ref([])
const callsLoading = ref(false)
const logoInput = ref(null)
const logoFile = ref(null)
const geetestDialogRef = ref(null)
const { geetestEnabled, fetchGeetestConfig } = useGeetestConfig()

const form = reactive({
  name: '',
  description: '',
  homepage_url: '',
  logo_url: '',
  redirect_uris_text: '',
  scopes: ['profile:read']
})
const scopeGroups = computed(() => [
  { key: 'identity', title: '身份与基础资料', description: '用户身份、公开资料和通知', items: scopeOptions.value.filter(s => s.risk === 'read' && /^(openid|profile|notifications)/.test(s.key)) },
  { key: 'public', title: '社区公开数据', description: '公开用户、作品、帖子、工作室、搜索和内容流', items: scopeOptions.value.filter(s => s.risk === 'read' && /public:read$|^(search|community:feed|community:stats)/.test(s.key)) },
  { key: 'analytics', title: '数据分析', description: '授权用户的作品、帖子、账号和应用调用统计', items: scopeOptions.value.filter(s => s.risk === 'read' && /analytics|developer:usage/.test(s.key)) },
  { key: 'studio', title: '工作室只读', description: '工作室资料、成员、申请、投稿和日志', items: scopeOptions.value.filter(s => s.risk === 'read' && /^studios:/.test(s.key)) },
  { key: 'content', title: '个人内容读取', description: '授权用户自己的作品、评论、帖子、收藏和动态', items: scopeOptions.value.filter(s => s.risk === 'read' && !/^(openid|profile|notifications|studios:)/.test(s.key) && !/public:read$|^(search|community:feed|community:stats)|analytics|developer:usage/.test(s.key)) },
  { key: 'write', title: '写入操作', description: '会修改用户数据，请谨慎申请', items: scopeOptions.value.filter(s => s.risk === 'write') },
  { key: 'admin', title: '管理权限', description: '高风险审核和管理能力', items: scopeOptions.value.filter(s => s.risk === 'admin') }
].filter(g => g.items.length))
const selectedScopeCount = (group) => group.items.filter(item => form.scopes.includes(item.key)).length

const statusText = (s) => ({
  pending: '待审核', active: '已通过', rejected: '已拒绝', suspended: '已停用'
}[s] || s)
const statusType = (s) => ({
  pending: 'warning', active: 'success', rejected: 'danger', suspended: 'info'
}[s] || 'info')
const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN') : '-'

const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); ElMessage.success('已复制') }
  catch { ElMessage.info(text) }
}

const loadApps = async () => {
  loading.value = true
  try {
    const res = await developerApi.listApps()
    if (res.code === 200) apps.value = res.data || []
    else ElMessage.error(res.msg || '加载失败')
  } catch (e) { ElMessage.error(e.response?.data?.msg || '加载失败') }
  finally { loading.value = false }
}
const loadScopes = async () => {
  try {
    const res = await developerApi.getScopeDocs()
    if (res.code === 200 && Array.isArray(res.data?.scopes)) scopeOptions.value = res.data.scopes
  } catch { /* defaults below */ }
}
const resetForm = () => {
  form.name = ''; form.description = ''; form.homepage_url = ''; form.logo_url = ''
  form.redirect_uris_text = ''; form.scopes = ['profile:read']; logoFile.value = null; editingId.value = null
}
const openCreate = () => { resetForm(); wizardStep.value = 0; dialogVisible.value = true }
const openEdit = (row) => {
  editingId.value = row.id
  form.name = row.name || ''; form.description = row.description || ''
  form.homepage_url = row.homepage_url || ''; form.logo_url = row.logo_url || ''
  form.redirect_uris_text = (row.redirect_uris || []).join('\n')
  form.scopes = [...(row.scopes_requested || ['profile:read'])]
  logoFile.value = null
  wizardStep.value = 0; detailVisible.value = false; dialogVisible.value = true
}
const onLogoSelected = (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) return ElMessage.warning('图标不能超过2MB'); logoFile.value = file }
const normalizeRedirectUris = () => form.redirect_uris_text.split(/\r?\n/).map(value => {
  const uri = value.trim()
  if (!uri) return ''
  if (/^localhost(?::\d+)?(?:\/|$)/i.test(uri) || /^127\.0\.0\.1(?::\d+)?(?:\/|$)/.test(uri)) return `http://${uri}`
  if (!/^https?:\/\//i.test(uri)) return `https://${uri}`
  return uri
}).filter(Boolean)
const validateRedirectUris = () => {
  const uris = normalizeRedirectUris()
  if (!uris.length) return { ok: false, message: '请至少填写一个回调地址' }
  for (const uri of uris) {
    try {
      const parsed = new URL(uri)
      const local = ['localhost', '127.0.0.1'].includes(parsed.hostname)
      if (parsed.hash) return { ok: false, message: `回调地址不能包含 #：${uri}` }
      if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return { ok: false, message: `回调地址必须使用 HTTPS：${uri}` }
    } catch { return { ok: false, message: `回调地址格式错误：${uri}` } }
  }
  form.redirect_uris_text = uris.join('\n')
  return { ok: true, uris }
}
const nextWizardStep = () => {
  if (wizardStep.value === 0 && !form.name.trim()) return ElMessage.warning('请填写应用名称')
  if (wizardStep.value === 1) { const result = validateRedirectUris(); if (!result.ok) return ElMessage.warning(result.message) }
  if (wizardStep.value === 2 && !form.scopes.length) return ElMessage.warning('请至少选择一个权限')
  wizardStep.value = Math.min(3, wizardStep.value + 1)
}
const showDetail = async (row) => { detailApp.value = row; detailVisible.value = true; await loadCalls(row) }
const loadCalls = async (row) => {
  if (!row?.id) return
  callsLoading.value = true
  try { const res = await developerApi.listAppCalls(row.id, { page: 1, pageSize: 50 }); calls.value = res.data?.list || [] }
  catch (e) { ElMessage.error(e.response?.data?.msg || '加载调用记录失败') }
  finally { callsLoading.value = false }
}
const formatPayload = (value) => { if (value == null || value === '') return '无记录'; try { return typeof value === 'string' ? JSON.stringify(JSON.parse(value), null, 2) : JSON.stringify(value, null, 2) } catch { return String(value) } }
const authExample = (app) => {
  if (!app) return ''
  const redirect = (app.redirect_uris && app.redirect_uris[0]) || 'https://your.app/callback'
  const scope = (app.scopes_requested || ['profile:read']).join(' ')
  return `/oauth/authorize?response_type=code&client_id=${app.client_id}&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scope)}&state=xyz`
}
const submitForm = async () => {
  if (!form.name.trim()) { ElMessage.warning('请填写应用名称'); return }
  const redirectResult = validateRedirectUris()
  if (!redirectResult.ok) { ElMessage.warning(redirectResult.message); wizardStep.value = 1; return }
  const redirect_uris = redirectResult.uris
  if (!form.scopes.length) { ElMessage.warning('请至少选择一个权限'); return }
  let geetestData = {}
  // 新建应用属于“申请”操作；普通编辑不重复要求申请场景验证。
  if (!editingId.value && geetestEnabled('developer_app')) {
    geetestData = await geetestDialogRef.value?.show('developer_app')
    if (!geetestData) return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(), description: form.description, homepage_url: form.homepage_url,
      logo_url: form.logo_url, redirect_uris, scopes: form.scopes, ...geetestData
    }
    let res
    if (editingId.value) res = await developerApi.updateApp(editingId.value, payload)
    else res = await developerApi.createApp(payload)
    if (res.code === 200) {
      ElMessage.success(res.msg || '保存成功')
      if (logoFile.value && res.data?.id) {
        const uploadRes = await developerApi.uploadAppLogo(res.data.id, logoFile.value)
        if (uploadRes.code !== 200) ElMessage.warning(uploadRes.msg || '图标上传失败')
      }
      if (res.data?.client_secret) secretOnce.value = { client_id: res.data.client_id, client_secret: res.data.client_secret }
      dialogVisible.value = false
      await loadApps()
    } else { ElMessage.error(res.msg || '保存失败') }
  } catch (e) { ElMessage.error(e.response?.data?.msg || '保存失败') }
  finally { saving.value = false }
}
const handleRotate = async (row) => {
  try {
    await ElMessageBox.confirm('重置后旧 client_secret 立即失效，确认继续？', '重置密钥', { type: 'warning' })
    const res = await developerApi.rotateSecret(row.id)
    if (res.code === 200 && res.data?.client_secret) {
      secretOnce.value = { client_id: res.data.client_id || row.client_id, client_secret: res.data.client_secret }
      ElMessage.success('密钥已重置，请立即保存'); await loadApps()
    } else { ElMessage.error(res.msg || '重置失败') }
  } catch (e) { if (e !== 'cancel') ElMessage.error(e.response?.data?.msg || '重置失败') }
}
onMounted(async () => { await fetchGeetestConfig(); await loadScopes(); await loadApps() })
</script>

<style scoped lang="scss">
.r-dev--page { min-height: 100vh; background: radial-gradient(circle at 10% 0%, #fff4d6 0, transparent 32%), linear-gradient(145deg,#f7f9fc,#eef3f8); padding: 42px 24px 64px; }
.r-dev--container { max-width: 1180px; margin: 0 auto; background: rgba(255,255,255,.92); border: 1px solid rgba(255,255,255,.9); border-radius: 18px; padding: 32px; box-shadow: 0 18px 50px rgba(36,54,74,.10); }
.r-dev--header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px;
  h1 { margin: 0 0 6px; font-size: 22px; color: #333; } }
.r-dev--back_home { padding: 0 0 8px; color: #6b7280; font-size: 13px; }
.r-dev--back_home:hover { color: #d97706; }
.r-dev--subtitle { margin: 0; color: #888; font-size: 13px; }
.r-dev--header_actions { display: flex; gap: 8px; flex-wrap: wrap; }
.r-dev--secret_alert { margin-bottom: 16px; }
.r-dev--secret_box { margin-top: 8px; display: flex; flex-direction: column; gap: 6px;
  code { word-break: break-all; background: #fff7e6; padding: 2px 6px; border-radius: 4px; } }
.r-dev--code { font-size: 12px; word-break: break-all; }
.r-dev--scope_tag { margin: 0 4px 4px 0; }
.r-dev--pre { background: #f5f5f5; padding: 10px; border-radius: 8px; white-space: pre-wrap; word-break: break-all; font-size: 12px; }
.r-dev--hint { color: #888; font-size: 13px; }
.r-dev--calls_head { display:flex; align-items:center; justify-content:space-between; margin: 8px 0; }
.r-dev--payload { padding: 8px; background: #fafafa; }
.r-dev--payload pre { white-space: pre-wrap; word-break: break-all; max-height: 160px; overflow:auto; background:#f1f3f5; padding:6px; border-radius:4px; font-size:11px; }
.r-dev--scope_summary { margin-bottom:10px; padding:9px 12px; border-radius:8px; background:#fff8e6; color:#7a5a12; font-size:13px; }
.r-dev--scope_collapse { width:100%; border:1px solid #e7ebf2; border-radius:10px; overflow:hidden; }
.r-dev--scope_collapse :deep(.el-collapse-item__header) { min-height:52px; height:auto; padding:8px 14px; background:#fafcff; }
.r-dev--scope_collapse :deep(.el-collapse-item__content) { padding:14px; }
.r-dev--scope_group_title { display:flex; align-items:center; gap:10px; width:100%; padding-right:10px; color:#303133; }
.r-dev--scope_group_title span { color:#909399; font-size:12px; }
.r-dev--scope_group_title .el-tag { margin-left:auto; flex:none; }
.r-dev--scope_grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; }
.r-dev--scope_grid .el-checkbox { margin-right:0; min-height:30px; }
.r-dev--scope_grid code { margin-left:4px; color:#909399; font-size:11px; }
.r-dev--review_box { padding:16px; border:1px solid #e4e7ed; border-radius:8px; background:#fafafa; }
.r-dev--detail_actions { display:flex; gap:8px; margin:16px 0; padding-top:12px; border-top:1px solid #ebeef5; }
.r-dev--detail_actions { padding:12px; border:1px solid #e7ebf2; border-radius:10px; background:#fff; }
.r-dev--upload_hint { margin-left:8px; color:#909399; font-size:12px; }
.r-dev--app_name { display:flex; align-items:center; gap:10px; font-weight:600; }
.r-dev--detail_name { display:flex; align-items:center; gap:12px; font-size:20px; margin: -8px -4px 18px; padding:16px; border-radius:14px; background:linear-gradient(135deg,#f7f4ff,#eef8ff); color:#202938; box-shadow:inset 0 1px 0 rgba(255,255,255,.9); }
.r-dev--wizard_form { max-width:100%; }
.r-dev--wizard_form :deep(.el-form-item) { margin-bottom:18px; }
.r-dev--wizard_form :deep(.el-form-item__label) { padding:0 0 7px; line-height:1.2; font-weight:600; color:#475569; }
.r-dev--wizard_form :deep(.el-form-item__content) { display:block; }
.r-dev--wizard_form :deep(.el-input), .r-dev--wizard_form :deep(.el-textarea) { width:100%; }
.r-dev--wizard_form :deep(.el-checkbox-group) { width:100%; }
.r-dev--detail_drawer :deep(.el-drawer__body) { padding:20px; background:#fbfcff; color:#334155; }
.r-dev--detail_drawer :deep(.el-drawer__header) { margin-bottom:0; padding:18px 20px; background:#fff; border-bottom:1px solid #eef1f6; }
.r-dev--detail_drawer :deep(.el-drawer__title) { font-weight:700; color:#1f2937; }
.r-dev--detail_drawer :deep(.el-drawer__body > p:not(.r-dev--detail_name)) { margin:10px 0; padding:10px 12px; border-radius:8px; background:#fff; border:1px solid #edf0f5; line-height:1.55; }
.r-dev--detail_drawer :deep(.el-drawer__body > ul) { margin:8px 0 14px; padding:10px 12px 10px 30px; background:#fff; border:1px solid #edf0f5; border-radius:8px; }
.r-dev--detail_drawer :deep(.el-drawer__body > ul code) { word-break:break-all; color:#64748b; font-size:12px; }
.r-dev--detail_drawer :deep(.el-divider) { margin:20px 0; border-color:#e8edf4; }
.r-dev--detail_drawer :deep(.el-table) { border-radius:10px; overflow:hidden; border:1px solid #e8edf4; }

/* 与首页统一的明亮开发者工作台 */
.r-dev--page {
  position: relative; overflow: hidden; padding: 54px 24px 80px;
  background: radial-gradient(circle at 8% 4%, rgba(255,205,92,.34), transparent 27rem), radial-gradient(circle at 92% 10%, rgba(108,190,255,.25), transparent 32rem), linear-gradient(145deg,#f4f8ff 0%,#fafbff 50%,#fff8eb 100%);
}
.r-dev--page::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.52; background-image:linear-gradient(rgba(95,125,170,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(95,125,170,.055) 1px,transparent 1px); background-size:44px 44px; mask-image:linear-gradient(to bottom,#000,transparent 74%); }
.r-dev--container { position:relative; z-index:1; max-width:1220px; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; }
.r-dev--header { align-items:flex-end; margin-bottom:30px; }
.r-dev--header h1 { margin:2px 0 9px; color:#172033; font-size:clamp(32px,3vw,44px); line-height:1.1; letter-spacing:-.045em; font-weight:800; }
.r-dev--back_home { color:#667085; font-weight:600; }
.r-dev--subtitle { color:#667085; font-size:15px; }
.r-dev--header_actions .el-button { height:44px; padding:0 18px; border-radius:12px; font-weight:700; }
.r-dev--header_actions .el-button--primary { color:#172033; border-color:#fec433; background:#fec433; box-shadow:0 10px 24px rgba(220,159,24,.24); }
.r-dev--secret_alert { border-radius:14px; box-shadow:0 12px 32px rgba(82,63,22,.08); }
.r-dev--apps_panel { overflow:hidden; border:1px solid rgba(255,255,255,.92); border-radius:20px; background:rgba(255,255,255,.82); backdrop-filter:blur(18px); box-shadow:0 20px 55px rgba(39,55,82,.09); }
.r-dev--section_head { display:flex; justify-content:space-between; align-items:center; padding:24px 26px 18px; border-bottom:1px solid #edf0f5; }
.r-dev--section_head h2 { margin:0 0 5px; color:#1b2436; font-size:19px; }
.r-dev--section_head p { margin:0; color:#8a94a6; font-size:13px; }
.r-dev--section_head > span { color:#667085; font-size:13px; font-weight:600; }
.r-dev--apps_panel :deep(.el-table), .r-dev--apps_panel :deep(.el-table tr), .r-dev--apps_panel :deep(.el-table th.el-table__cell) { background:transparent; }
.r-dev--apps_panel :deep(.el-table th.el-table__cell) { height:48px; color:#667085; font-size:12px; font-weight:700; }
.r-dev--apps_panel :deep(.el-table td.el-table__cell) { height:72px; border-bottom-color:#edf0f5; }
.r-dev--apps_panel :deep(.el-table__row) { transition:background .2s; }
.r-dev--apps_panel :deep(.el-table__row:hover > td.el-table__cell) { background:linear-gradient(90deg,rgba(255,248,228,.72),rgba(246,249,255,.72)); }
.r-dev--app_name :deep(.el-avatar) { box-shadow:0 0 0 3px #fff,0 5px 14px rgba(30,45,70,.13); }
.r-dev--code { display:inline-block; max-width:210px; overflow:hidden; text-overflow:ellipsis; color:#475467; font-family:"SFMono-Regular",Consolas,monospace; }
.r-dev--detail_drawer :deep(.el-drawer) { border-radius:24px 0 0 24px; overflow:hidden; box-shadow:-18px 0 55px rgba(26,39,61,.15); }
.r-dev--detail_drawer :deep(.el-drawer__header) { padding:24px 26px 18px; background:linear-gradient(135deg,#fffaf0,#f3f8ff); }
.r-dev--detail_drawer :deep(.el-drawer__body) { padding:24px 26px; background:#f8faff; }
.r-dev--detail_name { margin:0 0 18px; padding:18px; border:1px solid rgba(255,255,255,.9); border-radius:16px; background:linear-gradient(135deg,#fff7df,#eef7ff); box-shadow:0 10px 30px rgba(39,55,82,.08); }
.r-dev--detail_drawer :deep(.el-drawer__body > p:not(.r-dev--detail_name)), .r-dev--detail_drawer :deep(.el-drawer__body > ul) { border-color:#e7ebf2; border-radius:12px; box-shadow:0 5px 18px rgba(39,55,82,.035); }
.r-dev--detail_actions { padding:14px; border-radius:12px; box-shadow:0 6px 20px rgba(39,55,82,.04); }
.r-dev--pre { padding:14px; border:1px solid #e5eaf1; border-radius:12px; background:#f0f4f9; color:#344054; line-height:1.6; }
@media (max-width: 720px) { .r-dev--page{padding:30px 14px 56px}.r-dev--header{align-items:flex-start;flex-direction:column}.r-dev--header_actions{width:100%}.r-dev--header_actions .el-button{flex:1}.r-dev--apps_panel{border-radius:16px}.r-dev--section_head{padding:20px}.r-dev--detail_drawer :deep(.el-drawer){width:94%!important}.r-dev--scope_grid{grid-template-columns:1fr} }
</style>

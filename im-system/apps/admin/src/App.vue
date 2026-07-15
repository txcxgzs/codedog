<template>
  <div class="admin-shell">
    <aside>
      <div class="logo">编程狗<span>IM 管理后台</span></div>
      <nav>
        <button v-for="item in navigation" :key="item.key" :class="{ active: section === item.key }" @click="openSection(item.key)">{{ item.label }}</button>
      </nav>
      <small>编程狗即时通讯 v0.1</small>
    </aside>

    <main>
      <header>
        <div><h1>{{ currentSection.title }}</h1><p>{{ currentSection.description }}</p></div>
        <div class="status"><i></i>{{ me?.nickname || me?.username || '验证身份中' }}</div>
      </header>
      <p v-if="error" class="error">{{ error }}</p>

      <template v-if="section === 'audit'">
        <section class="query-panel">
          <label>会话 ID<input v-model="query.conversation_id" inputmode="numeric" placeholder="可选" /></label>
          <label>发送用户 ID<input v-model="query.user_id" inputmode="numeric" placeholder="可选" /></label>
          <label>关键词<input v-model="query.keyword" placeholder="消息正文" /></label>
          <label class="reason">查看原因（必填）<input v-model="reason" placeholder="请说明本次查看聊天内容的安全或审核原因" /></label>
          <button @click="search" :disabled="loading || reason.trim().length < 5">{{ loading ? '检索中' : '执行审计检索' }}</button>
        </section>
        <RecordsTable title="检索结果" :count="rows.length">
          <table><thead><tr><th>时间 / 序列</th><th>会话</th><th>发送者</th><th>内容</th><th>状态</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ formatDate(row.created_at) }}<small>#{{ row.sequence }}</small></td><td>{{ row.conversation_id }}</td><td>用户 {{ row.sender_id }}</td><td class="content">{{ row.content }}</td><td><span class="tag">{{ row.status }}</span></td></tr><tr v-if="!rows.length"><td colspan="5" class="empty">填写审计原因并执行检索</td></tr></tbody></table>
        </RecordsTable>
      </template>

      <template v-else-if="section === 'reports'">
        <RecordsTable title="待处理消息举报" :count="reports.length">
          <table><thead><tr><th>时间</th><th>会话 / 消息</th><th>举报用户</th><th>原因</th><th>状态</th></tr></thead><tbody><tr v-for="row in reports" :key="row.id"><td>{{ formatDate(row.created_at) }}</td><td>#{{ row.conversation_id }} / #{{ row.message_id }}</td><td>用户 {{ row.reporter_id }}</td><td class="content">{{ row.reason }}</td><td><span class="tag">{{ row.status }}</span></td></tr><tr v-if="!reports.length"><td colspan="5" class="empty">暂无消息举报</td></tr></tbody></table>
        </RecordsTable>
      </template>

      <template v-else-if="section === 'groups'">
        <section class="summary-grid">
          <div class="summary-card"><small>群聊总数</small><b>{{ groups.length }}</b><span>统一默认限制 100 人</span></div>
          <div class="summary-card"><small>例外群聊</small><b>{{ exceptionGroupCount }}</b><span>容量超过默认上限</span></div>
        </section>
        <section class="group-limit">
          <div><b>群容量例外</b><small>仅编程狗管理员可调整，修改原因会写入不可删除的审计日志</small></div>
          <input v-model="groupLimit.conversation_id" inputmode="numeric" placeholder="群会话 ID" />
          <input v-model="groupLimit.member_limit" inputmode="numeric" placeholder="新上限" />
          <input v-model="groupLimit.reason" placeholder="调整原因（至少 5 字）" />
          <button @click="updateGroupLimit" :disabled="savingLimit">{{ savingLimit ? '保存中' : '保存例外' }}</button>
        </section>
        <RecordsTable title="群聊列表" :count="groups.length">
          <table><thead><tr><th>群聊</th><th>群主</th><th>成员</th><th>容量</th><th>更新时间</th><th>操作</th></tr></thead><tbody><tr v-for="group in groups" :key="group.conversation_id"><td><b>{{ group.name }}</b><small>#{{ group.conversation_id }}</small></td><td>{{ displayName(group.owner, group.owner_id) }}</td><td>{{ group.member_count }}</td><td><span :class="['tag', { exception: group.member_limit > 100 }]">{{ group.member_limit }} 人</span></td><td>{{ formatDate(group.updated_at) }}</td><td><button class="table-action" @click="editGroupLimit(group)">调整容量</button></td></tr><tr v-if="!groups.length"><td colspan="6" class="empty">暂无群聊</td></tr></tbody></table>
        </RecordsTable>
      </template>

      <template v-else-if="section === 'online'">
        <section class="summary-grid"><div class="summary-card"><small>IM 服务</small><b class="healthy">正常</b><span>当前管理员会话已通过验证</span></div><div class="summary-card"><small>实时连接</small><b>已启用</b><span>WebSocket 安全链路</span></div></section>
        <section class="info-card"><h2>在线状态</h2><p>当前版本不长期存储在线轨迹，也不提供已读回执。在线信息仅用于实时消息投递，符合编程狗 IM 的最小数据原则。</p></section>
      </template>

      <template v-else>
        <section class="info-card"><h2>系统设置</h2><div class="setting-row"><span><b>默认群容量</b><small>所有普通群聊统一限制</small></span><strong>100 人</strong></div><div class="setting-row"><span><b>图片存储</b><small>复用编程狗现有图床，IM 不保存图片文件</small></span><strong>已启用</strong></div><div class="setting-row"><span><b>已读回执</b><small>按产品约定不采集消息已读状态</small></span><strong>关闭</strong></div></section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue'

const RecordsTable = defineComponent({ props: { title: String, count: Number }, setup(props, { slots }) { return () => h('section', { class: 'records' }, [h('div', { class: 'records-head' }, [h('b', props.title), h('span', `${props.count || 0} 条`)]), slots.default?.()]) } })
const navigation = [
  { key: 'audit', label: '聊天审计', title: '聊天记录审计', description: '高敏操作 · 所有查询均写入不可删除审计日志' },
  { key: 'reports', label: '举报处理', title: '消息举报处理', description: '集中查看用户提交的聊天消息举报' },
  { key: 'groups', label: '群聊管理', title: '群聊管理', description: '查看群聊状态并管理管理员容量例外' },
  { key: 'online', label: '在线状态', title: '在线状态', description: '查看即时通讯服务与实时链路状态' },
  { key: 'settings', label: '系统设置', title: '系统设置', description: '查看 IM 数据与功能策略' }
]
const section = ref('audit'), me = ref(null), rows = ref([]), reports = ref([]), groups = ref([])
const reason = ref(''), loading = ref(false), savingLimit = ref(false), error = ref('')
const query = reactive({ conversation_id: '', user_id: '', keyword: '' })
const groupLimit = reactive({ conversation_id: '', member_limit: '', reason: '' })
const currentSection = computed(() => navigation.find(item => item.key === section.value) || navigation[0])
const exceptionGroupCount = computed(() => groups.value.filter(group => Number(group.member_limit) > 100).length)
const api = async (url, options = {}) => { const response = await fetch(`/im/api${url}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }); const body = await response.json(); if (!response.ok) throw new Error(body.msg); return body.data }
const search = async () => { loading.value = true; error.value = ''; try { rows.value = await api('/admin/messages/search', { method: 'POST', body: JSON.stringify({ ...query, reason: reason.value.trim() }) }) } catch (e) { error.value = e.message } finally { loading.value = false } }
const loadReports = async () => { reports.value = await api('/admin/reports?status=pending') }
const loadGroups = async () => { groups.value = await api('/admin/groups') }
const openSection = async key => { section.value = key; error.value = ''; try { if (key === 'reports') await loadReports(); if (key === 'groups') await loadGroups() } catch (e) { error.value = e.message } }
const editGroupLimit = group => { groupLimit.conversation_id = String(group.conversation_id); groupLimit.member_limit = String(group.member_limit); groupLimit.reason = ''; window.scrollTo({ top: 0, behavior: 'smooth' }) }
const updateGroupLimit = async () => { error.value = ''; savingLimit.value = true; try { await api(`/groups/${groupLimit.conversation_id}`, { method: 'PATCH', body: JSON.stringify({ member_limit: Number(groupLimit.member_limit), reason: groupLimit.reason.trim() }) }); await loadGroups(); groupLimit.reason = ''; alert('群容量例外已保存并记录审计日志') } catch (e) { error.value = e.message } finally { savingLimit.value = false } }
const displayName = (user, id) => user?.nickname || user?.username || `用户 ${id}`
const formatDate = value => value ? new Date(value).toLocaleString('zh-CN') : '-'
onMounted(() => api('/me').then(value => { me.value = value; if (!['admin', 'superadmin'].includes(value.role)) error.value = '当前账号无权访问 IM 后台' }).catch(e => { error.value = e.message }))
</script>

<style scoped>
.summary-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:18px; }
.summary-card,.info-card { border:1px solid var(--border); border-radius:14px; background:#fff; box-shadow:0 8px 24px rgba(31,35,41,.05); }
.summary-card { display:grid; gap:7px; padding:20px; }.summary-card small,.summary-card span,.info-card p,.setting-row small{color:#9298a1}.summary-card b{font-size:28px}.summary-card .healthy{color:#38a169}
.group-limit { display:grid; grid-template-columns:1fr 130px 110px minmax(220px,1fr) auto; gap:10px; align-items:center; padding:16px 18px; border:1px solid #f0d27c; border-radius:12px; background:#fff9e6; box-shadow:0 8px 24px rgba(31,35,41,.04); }
.group-limit div { display:grid; gap:4px; }.group-limit small { color:#93845e; }.group-limit input { height:37px; min-width:0; border:1px solid #e2d7b8; border-radius:8px; background:#fff; color:#30343a; padding:0 10px; }.group-limit button,.table-action { border:0; border-radius:8px; background:#ffc43d; color:#14181e; font-weight:800; cursor:pointer }.group-limit button{height:37px}.group-limit button:disabled{opacity:.5}.table-action{padding:7px 10px}
.tag.exception{color:#c24141;background:#fff0f0}.info-card{padding:22px}.info-card h2{margin:0 0 8px}.setting-row{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid var(--border)}.setting-row:last-child{border-bottom:0}.setting-row span{display:grid;gap:5px}.setting-row strong{color:#a86f00}
@media(max-width:1050px){.group-limit{grid-template-columns:1fr 1fr}.group-limit div{grid-column:1/-1}}@media(max-width:850px){.summary-grid{grid-template-columns:1fr}}
</style>

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
        <div class="header-actions"><a :href="communityAdminUrl">返回编程狗后台</a><div class="status"><i></i>{{ me?.nickname || me?.username || '验证身份中' }}</div></div>
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
        <section class="report-summary">
          <button v-for="item in reportFilters" :key="item.key" :class="{ active: reportStatus === item.key }" @click="reportStatus = item.key; loadReports()"><span>{{ item.label }}</span><b>{{ reportCounts[item.key] }}</b></button>
        </section>
        <section class="report-toolbar"><div><b>举报审核工作台</b><span>逐条核对举报理由、原消息与上下文，所有处置写入审计日志</span></div><label>状态筛选<select v-model="reportStatus" @change="loadReports"><option value="pending">待处理</option><option value="resolved">已处理</option><option value="rejected">已驳回</option><option value="all">全部</option></select></label></section>
        <p v-if="feedback" class="feedback">{{ feedback }}</p>
        <RecordsTable title="消息举报" :count="filteredReports.length">
          <table><thead><tr><th>举报时间</th><th>被举报用户</th><th>违规消息</th><th>举报人与原因</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="row in filteredReports" :key="row.id"><td>{{ formatDate(row.created_at) }}<small>举报 #{{ row.id }} · 会话 #{{ row.conversation_id }}</small></td><td><b>{{ displayName(row.reported_user, row.message?.sender_id) }}</b><small>用户 ID {{ row.message?.sender_id || '-' }}</small></td><td class="content"><span :class="['message-state', { deleted: row.message?.status === 'hidden' }]">{{ row.message?.status === 'hidden' ? '已删除' : '当前可见' }}</span>{{ messagePreview(row.message) }}</td><td class="content"><b>{{ displayName(row.reporter, row.reporter_id) }}</b><small>{{ row.reason }}</small></td><td><span :class="['tag', `tag-${row.status}`]">{{ statusLabel(row.status) }}</span><small v-if="row.resolution_action">{{ actionLabel(row.resolution_action) }}</small></td><td><button class="table-action" @click="selectReport(row)">{{ row.status === 'pending' ? '审核处理' : '查看详情' }}</button></td></tr><tr v-if="!filteredReports.length"><td colspan="6" class="empty">当前筛选下暂无举报</td></tr></tbody></table>
        </RecordsTable>

        <div v-if="selectedReport" class="modal-mask" @click.self="closeReport">
          <section class="report-dialog">
            <header><div><small>举报审核 #{{ selectedReport.id }}</small><h2>{{ selectedReport.status === 'pending' ? '核查并处置违规消息' : '举报处理详情' }}</h2></div><button class="dialog-close" @click="closeReport">×</button></header>
            <div class="report-meta"><div><span>举报人</span><b>{{ displayName(selectedReport.reporter, selectedReport.reporter_id) }}</b><small>ID {{ selectedReport.reporter_id }}</small></div><div><span>被举报用户</span><b>{{ displayName(selectedReport.reported_user, selectedReport.message?.sender_id) }}</b><small>ID {{ selectedReport.message?.sender_id }}</small></div><div><span>举报时间</span><b>{{ formatDate(selectedReport.created_at) }}</b><small>会话 #{{ selectedReport.conversation_id }}</small></div><div><span>当前状态</span><b>{{ statusLabel(selectedReport.status) }}</b><small>{{ actionLabel(selectedReport.resolution_action) }}</small></div></div>
            <div class="reason-card"><span>举报原因</span><p>{{ selectedReport.reason }}</p></div>
            <div class="evidence"><div class="evidence-title"><b>聊天上下文</b><span>展示被举报消息前后各 5 条，红框为被举报内容</span></div><div class="message-list"><article v-for="item in selectedReport.context || []" :key="item.id" :class="{ reported: Number(item.id) === Number(selectedReport.message_id), removed: item.status === 'hidden' }"><div><b>{{ displayName(item.sender, item.sender_id) }}</b><small>#{{ item.sequence }} · {{ formatDate(item.created_at) }}</small></div><p>{{ readableMessage(item) }}</p><span v-if="Number(item.id) === Number(selectedReport.message_id)">被举报消息</span></article><p v-if="!selectedReport.context?.length" class="empty-context">消息已不存在或暂无上下文</p></div></div>
            <div v-if="selectedReport.status === 'pending'" class="decision"><label><span>处理意见 <i>{{ resolutionReason.length }}/500</i></span><textarea v-model="resolutionReason" maxlength="500" placeholder="说明判断依据和处置原因，至少 5 个字"></textarea></label><div class="decision-tip"><b>处置说明</b><span>“确认违规”仅记录结论；删除采用软删除，原文只保留在管理员审计中；禁用会同步到编程狗主账号。</span></div></div>
            <div v-else class="handled"><b>{{ actionLabel(selectedReport.resolution_action) }}</b><p>{{ selectedReport.resolution_reason }}</p><span>处理人：{{ displayName(selectedReport.handler, selectedReport.resolved_by) }} · {{ formatDate(selectedReport.resolved_at) }}</span></div>
            <footer v-if="selectedReport.status === 'pending'"><button class="plain" :disabled="!canResolve" @click="askAction('reject')">驳回举报</button><button class="warning" :disabled="!canResolve" @click="askAction('confirm')">确认违规</button><button class="danger-outline" :disabled="!canResolve" @click="askAction('delete_message')">删除违规消息</button><button class="danger" :disabled="!canResolve" @click="askAction('delete_and_disable')">删除消息并禁用用户</button></footer>
          </section>
        </div>
        <div v-if="confirmAction" class="modal-mask confirm-mask"><section class="confirm-dialog"><div class="confirm-icon">!</div><h3>{{ confirmCopy.title }}</h3><p>{{ confirmCopy.text }}</p><div><button class="plain" @click="confirmAction = ''">取消</button><button :class="confirmCopy.danger ? 'danger' : 'warning'" :disabled="resolving" @click="resolveReport">{{ resolving ? '处理中…' : confirmCopy.button }}</button></div></section></div>
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
const reason = ref(''), loading = ref(false), savingLimit = ref(false), error = ref(''), feedback = ref('')
const reportStatus = ref('pending'), selectedReport = ref(null), resolutionReason = ref(''), resolving = ref(false), confirmAction = ref('')
const reportFilters = [{ key:'pending', label:'待处理' }, { key:'resolved', label:'已处理' }, { key:'rejected', label:'已驳回' }, { key:'all', label:'全部' }]
const query = reactive({ conversation_id: '', user_id: '', keyword: '' })
const groupLimit = reactive({ conversation_id: '', member_limit: '', reason: '' })
const currentSection = computed(() => navigation.find(item => item.key === section.value) || navigation[0])
const communityAdminUrl = computed(() => `${String(me.value?.community_url || 'https://54188.xyz').replace(/\/$/, '')}/admin`)
const exceptionGroupCount = computed(() => groups.value.filter(group => Number(group.member_limit) > 100).length)
const reportCounts = computed(() => ({ pending: reports.value.filter(item => item.status === 'pending').length, resolved: reports.value.filter(item => item.status === 'resolved').length, rejected: reports.value.filter(item => item.status === 'rejected').length, all: reports.value.length }))
const filteredReports = computed(() => reportStatus.value === 'all' ? reports.value : reports.value.filter(item => item.status === reportStatus.value))
const canResolve = computed(() => !resolving.value && resolutionReason.value.trim().length >= 5)
const confirmCopy = computed(() => ({
  reject:{ title:'确认驳回这条举报？', text:'举报将标记为已驳回，处理意见和管理员身份会永久写入审计日志。', button:'确认驳回' },
  confirm:{ title:'确认内容违规？', text:'仅记录违规结论，不会删除消息或禁用用户。', button:'确认违规' },
  delete_message:{ title:'删除这条违规消息？', text:'消息会对所有聊天成员显示为“因违规已删除”，原始证据仅供管理员审计。', button:'删除消息', danger:true },
  delete_and_disable:{ title:'删除消息并禁用用户？', text:'这是高风险操作：消息将被删除，用户的编程狗主账号会被同步禁用并断开 IM 会话。', button:'删除并禁用', danger:true }
}[confirmAction.value] || {}))
const api = async (url, options = {}) => { const response = await fetch(`/im/api${url}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }); const body = await response.json(); if (!response.ok) throw new Error(body.msg); return body.data }
const search = async () => { loading.value = true; error.value = ''; try { rows.value = await api('/admin/messages/search', { method: 'POST', body: JSON.stringify({ ...query, reason: reason.value.trim() }) }) } catch (e) { error.value = e.message } finally { loading.value = false } }
const loadReports = async () => { reports.value = await api('/admin/reports'); selectedReport.value = null }
const loadGroups = async () => { groups.value = await api('/admin/groups') }
const openSection = async key => { section.value = key; error.value = ''; try { if (key === 'reports') await loadReports(); if (key === 'groups') await loadGroups() } catch (e) { error.value = e.message } }
const editGroupLimit = group => { groupLimit.conversation_id = String(group.conversation_id); groupLimit.member_limit = String(group.member_limit); groupLimit.reason = ''; window.scrollTo({ top: 0, behavior: 'smooth' }) }
const updateGroupLimit = async () => { error.value = ''; feedback.value = ''; savingLimit.value = true; try { await api(`/groups/${groupLimit.conversation_id}`, { method: 'PATCH', body: JSON.stringify({ member_limit: Number(groupLimit.member_limit), reason: groupLimit.reason.trim() }) }); await loadGroups(); groupLimit.reason = ''; feedback.value = '群容量例外已保存并记录审计日志' } catch (e) { error.value = e.message } finally { savingLimit.value = false } }
const selectReport = async row => { error.value = ''; try { selectedReport.value = await api(`/admin/reports/${row.id}`); resolutionReason.value = selectedReport.value.resolution_reason || '' } catch (e) { error.value = e.message } }
const closeReport = () => { if (!resolving.value) { selectedReport.value = null; confirmAction.value = '' } }
const askAction = action => { if (canResolve.value) confirmAction.value = action }
const resolveReport = async () => { const action = confirmAction.value; resolving.value = true; error.value = ''; feedback.value = ''; try { const result = await api(`/admin/reports/${selectedReport.value.id}`, { method:'PATCH', body:JSON.stringify({ action, reason:resolutionReason.value.trim() }) }); feedback.value = ({ reject:'举报已驳回', confirm:'已确认内容违规', delete_message:'违规消息已删除', delete_and_disable:'违规消息已删除，用户已同步禁用' })[action] || '处置完成'; confirmAction.value = ''; selectedReport.value = null; await loadReports(); return result } catch (e) { confirmAction.value = ''; error.value = e.message } finally { resolving.value = false } }
const statusLabel = status => ({ pending:'待处理', resolved:'已处理', rejected:'已驳回' }[status] || status)
const actionLabel = action => ({ reject:'驳回举报', confirm:'确认违规', delete_message:'已删除违规消息', delete_and_disable:'已删除消息并禁用用户' }[action] || (action ? action : '尚未处置'))
const readableMessage = item => item?.status === 'hidden' ? '该消息因违规已被管理员删除（原始证据已保留）' : item?.type === 'image' ? '[图片消息]' : (item?.content || '消息内容为空')
const messagePreview = item => { const value = readableMessage(item); return value.length > 80 ? `${value.slice(0, 80)}…` : value }
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
.header-actions{display:flex;align-items:center;gap:10px}.header-actions>a{padding:9px 13px;border:1px solid var(--border);border-radius:9px;background:#fff;color:#a86f00;text-decoration:none;font-size:12px}.header-actions>a:hover{border-color:var(--primary);background:var(--light)}
.report-toolbar{display:flex;justify-content:space-between;align-items:end;padding:16px 18px;border:1px solid var(--border);border-radius:13px;background:#fff;box-shadow:0 8px 24px rgba(31,35,41,.04)}.report-toolbar label{display:grid;gap:6px;color:#7f858e;font-size:11px}.report-toolbar select{min-width:150px;height:38px;border:1px solid #dfe2e7;border-radius:8px;background:#fafafa;padding:0 10px}.report-toolbar span{color:#9a9fa7;font-size:12px}
.report-toolbar>div{display:grid;gap:5px}.report-toolbar>div span{font-size:12px}.report-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.report-summary button{display:flex;justify-content:space-between;align-items:center;padding:15px 17px;border:1px solid var(--border);border-radius:12px;background:#fff;color:#747a83;cursor:pointer}.report-summary button b{font-size:20px;color:#2e3238}.report-summary button.active{border-color:#efc04d;background:#fff9e6;box-shadow:inset 3px 0 #fec433}.message-state{display:inline-block;margin-right:8px;padding:3px 6px;border-radius:5px;background:#edf9e9;color:#3d8c46;font-size:10px}.message-state.deleted{background:#fff0f0;color:#ca4646}.tag-pending{background:#fff7db;color:#ad7500}.tag-resolved{background:#edf9e9;color:#378742}.tag-rejected{background:#f2f3f5;color:#747a83}.feedback{padding:11px 14px;border:1px solid #bee0b5;border-radius:9px;background:#f1faee;color:#39813d}
.modal-mask{position:fixed;z-index:80;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(20,24,30,.5);backdrop-filter:blur(3px)}.report-dialog{width:min(1040px,96vw);max-height:92vh;overflow:auto;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.22)}.report-dialog>header{position:sticky;top:0;z-index:2;margin:0;padding:20px 24px;border-bottom:1px solid var(--border);background:#fff}.report-dialog>header small{color:#b37a00}.report-dialog h2{margin:4px 0 0;font-size:21px}.dialog-close{width:34px;height:34px;border:1px solid var(--border);border-radius:50%;background:#fff;color:#777;font-size:22px;cursor:pointer}.report-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:20px 24px 0}.report-meta>div{display:grid;gap:5px;padding:13px;border:1px solid #eceef1;border-radius:10px;background:#fafafa}.report-meta span,.report-meta small{color:#9298a1;font-size:11px}.reason-card{margin:14px 24px;padding:14px 16px;border-left:4px solid #fec433;border-radius:8px;background:#fff9e6}.reason-card span{font-size:11px;color:#9a7d3b}.reason-card p{margin:7px 0 0}.evidence{margin:0 24px;border:1px solid var(--border);border-radius:12px;overflow:hidden}.evidence-title{display:flex;justify-content:space-between;padding:13px 15px;background:#fafafa}.evidence-title span{font-size:11px;color:#9298a1}.message-list{display:grid;gap:8px;padding:14px;max-height:290px;overflow:auto}.message-list article{position:relative;display:grid;grid-template-columns:170px 1fr;gap:12px;padding:11px 13px;border:1px solid #eceef1;border-radius:9px}.message-list article.reported{border:2px solid #ef6868;background:#fff6f6}.message-list article.removed{background:#f7f7f7}.message-list article div{display:grid;gap:4px}.message-list article small{color:#a0a5ad}.message-list article p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.message-list article>span{position:absolute;right:9px;top:-10px;padding:2px 7px;border-radius:8px;background:#e94f4f;color:#fff;font-size:10px}.empty-context{text-align:center;color:#aaa}.decision{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;padding:16px 24px}.decision label{display:grid;gap:7px}.decision label>span{font-weight:700}.decision label i{float:right;color:#aaa;font-style:normal;font-weight:400}.decision textarea{min-height:90px;resize:vertical;border:1px solid #dfe2e7;border-radius:10px;padding:12px;outline:none}.decision textarea:focus{border-color:#fec433}.decision-tip{display:grid;align-content:center;gap:7px;padding:14px;border-radius:10px;background:#fff7e1;color:#8b6921}.decision-tip span{font-size:11px;line-height:1.7}.handled{margin:16px 24px;padding:15px;border:1px solid #bee0b5;border-radius:10px;background:#f1faee}.handled p{margin:8px 0}.handled span{color:#758079;font-size:11px}.report-dialog>footer{display:flex;justify-content:flex-end;gap:9px;padding:15px 24px 21px;border-top:1px solid var(--border)}.report-dialog button,.confirm-dialog button{min-height:38px;padding:0 14px;border-radius:8px;font-weight:700;cursor:pointer}.plain{border:1px solid #dfe2e7;background:#fff;color:#5f6670}.warning{border:0;background:#fec433;color:#24272b}.danger-outline{border:1px solid #ef9a9a;background:#fff;color:#d74343}.danger{border:0;background:#e95353;color:#fff}.report-dialog button:disabled{opacity:.42;cursor:not-allowed}.confirm-mask{z-index:100}.confirm-dialog{width:min(430px,92vw);padding:25px;border-radius:16px;background:#fff;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25)}.confirm-icon{width:46px;height:46px;margin:auto;border-radius:50%;background:#fff0db;color:#d88c00;font-size:28px;font-weight:900;line-height:46px}.confirm-dialog h3{margin:14px 0 8px}.confirm-dialog p{color:#777;line-height:1.7}.confirm-dialog>div:last-child{display:flex;justify-content:center;gap:10px;margin-top:20px}
@media(max-width:1050px){.group-limit{grid-template-columns:1fr 1fr}.group-limit div{grid-column:1/-1}.report-meta{grid-template-columns:1fr 1fr}}@media(max-width:850px){.summary-grid{grid-template-columns:1fr}.report-summary{grid-template-columns:1fr 1fr}.decision{grid-template-columns:1fr}.message-list article{grid-template-columns:1fr}.report-dialog>footer{flex-wrap:wrap}}
</style>

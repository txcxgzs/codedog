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

      <template v-if="section === 'dashboard'">
        <section class="dashboard-grid">
          <article v-for="card in dashboardCards" :key="card.label" class="dashboard-card"><span>{{ card.icon }}</span><div><small>{{ card.label }}</small><b>{{ card.value }}</b><em>{{ card.note }}</em></div></article>
        </section>
        <div class="dashboard-columns">
          <section class="panel"><div class="panel-head"><div><b>待办与近期举报</b><small>优先处理未审核的用户举报</small></div><button class="table-action" @click="openSection('reports')">进入举报处理</button></div><div class="activity-list"><button v-for="report in dashboard.recent_reports || []" :key="report.id" @click="openReportFromDashboard(report)"><span :class="['activity-dot', `dot-${report.status}`]"></span><div><b>{{ displayName(report.reported_user, report.message?.sender_id) }}</b><small>{{ report.reason }}</small></div><em>{{ statusLabel(report.status) }}</em></button><p v-if="!dashboard.recent_reports?.length" class="empty-block">暂无举报记录</p></div></section>
          <section class="panel"><div class="panel-head"><div><b>IM 运行概况</b><small>只展示必要运行数据，不采集已读回执</small></div><span class="health-badge">运行正常</span></div><div class="health-list"><p><span>实时在线用户</span><b>{{ dashboard.online_users || 0 }}</b></p><p><span>今日发送消息</span><b>{{ dashboard.today_messages || 0 }}</b></p><p><span>管理审计记录</span><b>{{ dashboard.audit_logs || 0 }}</b></p><p><span>数据存储</span><b>MySQL</b></p></div></section>
        </div>
      </template>

      <template v-else-if="section === 'users'">
        <section class="management-toolbar"><div><b>用户目录</b><span>查看通过编程狗 SSO 进入过 IM 的账号及活跃概况</span></div><label><input v-model="userKeyword" placeholder="搜索昵称、用户名或用户 ID" @keyup.enter="loadUsers" /><button @click="loadUsers">搜索</button></label></section>
        <RecordsTable title="IM 用户" :count="users.length"><table><thead><tr><th>用户</th><th>编程猫 ID</th><th>角色</th><th>会话</th><th>消息</th><th>资料同步</th><th>操作</th></tr></thead><tbody><tr v-for="user in users" :key="user.id"><td><div class="user-cell"><img :src="user.avatar || fallbackAvatar" /><span><b>{{ displayName(user, user.id) }}</b><small>@{{ user.username }} · ID {{ user.id }}</small></span></div></td><td>{{ user.codemao_user_id || '-' }}</td><td><span class="tag">{{ roleLabel(user.role) }}</span></td><td>{{ user.conversation_count }}</td><td>{{ user.message_count }}</td><td>{{ formatDate(user.updated_at) }}</td><td><button class="table-action" @click="selectUser(user)">查看详情</button></td></tr><tr v-if="!users.length"><td colspan="7" class="empty">暂无匹配用户</td></tr></tbody></table></RecordsTable>
        <div v-if="selectedUser" class="modal-mask" @click.self="selectedUser = null"><section class="user-dialog"><header><div class="user-cell"><img :src="selectedUser.avatar || fallbackAvatar" /><span><h2>{{ displayName(selectedUser, selectedUser.id) }}</h2><small>@{{ selectedUser.username }} · 用户 ID {{ selectedUser.id }}</small></span></div><button class="dialog-close" @click="selectedUser = null">×</button></header><div class="user-detail-grid"><div><small>账号角色</small><b>{{ roleLabel(selectedUser.role) }}</b></div><div><small>所在会话</small><b>{{ selectedUser.memberships?.length || 0 }}</b></div><div><small>历史消息</small><b>{{ selectedUser.message_count || 0 }}</b></div><div><small>近期被举报</small><b>{{ selectedUser.reports_received || 0 }}</b></div></div><div class="user-dialog-note"><b>账号管理说明</b><p>IM 不单独维护封禁状态。需要禁用账号时，应在编程狗用户管理或举报处置中执行，状态会同步到 IM 并断开会话。</p></div><footer><a :href="communityUserUrl(selectedUser)" target="_blank" rel="noopener">打开编程狗主页</a><a :href="communityAdminUrl">前往编程狗用户管理</a></footer></section></div>
      </template>

      <template v-else-if="section === 'conversations'">
        <section class="management-toolbar"><div><b>全部会话</b><span>统一查看私聊和群聊的成员规模与消息序列</span></div><label class="select-label">会话类型<select v-model="conversationType" @change="loadConversations"><option value="all">全部</option><option value="direct">私聊</option><option value="group">群聊</option></select></label></section>
        <RecordsTable title="会话列表" :count="conversations.length"><table><thead><tr><th>会话</th><th>类型</th><th>成员</th><th>最新序列</th><th>最近更新</th><th>快捷操作</th></tr></thead><tbody><tr v-for="item in conversations" :key="item.id"><td><b>{{ item.name || `私聊 #${item.id}` }}</b><small>会话 ID {{ item.id }}</small></td><td><span :class="['tag', item.type === 'group' ? 'tag-resolved' : '']">{{ item.type === 'group' ? '群聊' : '私聊' }}</span></td><td><div class="member-stack"><img v-for="member in item.members" :key="member.id" :src="member.avatar || fallbackAvatar" :title="displayName(member, member.id)" /><span>{{ item.member_count }} 人</span></div></td><td>#{{ item.last_sequence }}</td><td>{{ formatDate(item.updated_at) }}</td><td><button class="table-action" @click="auditConversation(item)">审计消息</button><button v-if="item.type === 'group'" class="link-action" @click="openSection('groups')">群聊管理</button></td></tr><tr v-if="!conversations.length"><td colspan="6" class="empty">暂无会话</td></tr></tbody></table></RecordsTable>
      </template>

      <template v-else-if="section === 'logs'">
        <section class="management-toolbar"><div><b>管理员操作日志</b><span>聊天检索、举报处置和群聊资料修改均不可删除</span></div><label class="select-label">操作类型<select v-model="auditAction" @change="loadAudits"><option value="">全部</option><option value="messages.search">聊天检索</option><option value="report.confirm">确认违规</option><option value="report.delete_message">删除消息</option><option value="report.delete_and_disable">删除并禁用</option><option value="group.profile.update">群聊资料修改</option><option value="group.member_limit.update">旧版群容量调整</option></select></label></section>
        <RecordsTable title="审计日志" :count="audits.length"><table><thead><tr><th>时间</th><th>管理员</th><th>操作</th><th>原因</th><th>关联对象</th><th>来源 IP</th></tr></thead><tbody><tr v-for="item in audits" :key="item.id"><td>{{ formatDate(item.created_at) }}<small>日志 #{{ item.id }}</small></td><td>{{ displayName(item.admin, item.admin_id) }}</td><td><span class="tag">{{ auditActionLabel(item.action) }}</span></td><td class="content">{{ item.reason }}</td><td class="content"><code>{{ compactFilters(item.filters) }}</code></td><td>{{ item.source_ip || '-' }}</td></tr><tr v-if="!audits.length"><td colspan="6" class="empty">暂无审计记录</td></tr></tbody></table></RecordsTable>
      </template>

      <template v-else-if="section === 'audit'">
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
        <RecordsTable title="群聊列表" :count="groups.length">
          <table><thead><tr><th>群聊</th><th>群主</th><th>成员</th><th>容量</th><th>更新时间</th><th>操作</th></tr></thead><tbody><tr v-for="group in groups" :key="group.conversation_id"><td><b>{{ group.name }}</b><small>#{{ group.conversation_id }}</small></td><td>{{ displayName(group.owner, group.owner_id) }}</td><td>{{ group.member_count }}</td><td><span :class="['tag', { exception: group.member_limit > 100 }]">{{ group.member_limit }} 人</span></td><td>{{ formatDate(group.updated_at) }}</td><td><button class="table-action" @click="openGroupDetail(group)">查看详情</button></td></tr><tr v-if="!groups.length"><td colspan="6" class="empty">暂无群聊</td></tr></tbody></table>
        </RecordsTable>

        <div v-if="selectedGroup" class="modal-mask" @click.self="closeGroupDetail">
          <section class="group-detail-dialog">
            <header>
              <div class="group-detail-title"><span>群</span><div><small>群会话 #{{ selectedGroup.conversation_id }}</small><h2>{{ selectedGroup.name }}</h2><p>创建于 {{ formatDate(selectedGroup.created_at) }} · 最近更新 {{ formatDate(selectedGroup.updated_at) }}</p></div></div>
              <button class="dialog-close" @click="closeGroupDetail">×</button>
            </header>
            <div class="group-detail-stats">
              <div><small>群主</small><b>{{ displayName(selectedGroup.owner, selectedGroup.owner_id) }}</b></div>
              <div><small>有效成员</small><b>{{ selectedGroup.member_count }} 人</b></div>
              <div><small>历史消息</small><b>{{ selectedGroup.message_count || 0 }} 条</b></div>
              <div><small>群容量</small><b>{{ selectedGroup.member_limit }} 人</b></div>
            </div>
            <nav class="group-detail-tabs">
              <button :class="{ active: groupDetailTab === 'overview' }" @click="groupDetailTab = 'overview'">基本信息</button>
              <button :class="{ active: groupDetailTab === 'members' }" @click="groupDetailTab = 'members'">成员 {{ selectedGroup.members?.length || 0 }}</button>
              <button :class="{ active: groupDetailTab === 'audits' }" @click="groupDetailTab = 'audits'">操作日志 {{ selectedGroup.audits?.length || 0 }}</button>
            </nav>
            <div v-if="groupDetailError" class="group-detail-error">{{ groupDetailError }}</div>

            <div v-if="groupDetailTab === 'overview'" class="group-overview">
              <section class="group-edit-card">
                <div><h3>群聊资料</h3><p>群名和容量均在这里修改；只有实际发生变更时才可保存。</p></div>
                <label><span>群聊名称</span><input v-model="groupEdit.name" maxlength="50" placeholder="1–50 个字符" /></label>
                <label><span>成员上限</span><input v-model.number="groupEdit.member_limit" type="number" min="100" max="5000" /><small>超过默认 100 人即为管理员容量例外</small></label>
                <label class="group-reason"><span>修改原因</span><textarea v-model="groupEdit.reason" maxlength="500" placeholder="请具体说明本次修改原因（至少 5 个字），将永久写入审计日志"></textarea><small>{{ groupEdit.reason.length }}/500</small></label>
                <footer>
                  <span v-if="!groupDirty">当前没有未保存的修改</span>
                  <button v-if="groupDirty" :disabled="groupSaving || groupEdit.reason.trim().length < 5" @click="saveGroupDetail">{{ groupSaving ? '保存中…' : '保存修改' }}</button>
                </footer>
              </section>
              <section class="group-info-card">
                <h3>群聊标识</h3>
                <p><span>群聊 ID</span><code>{{ selectedGroup.id }}</code></p>
                <p><span>会话 ID</span><code>{{ selectedGroup.conversation_id }}</code></p>
                <p><span>当前序列</span><b>#{{ selectedGroup.conversation?.last_sequence || 0 }}</b></p>
                <button class="plain" @click="auditSelectedGroup">审计该群消息</button>
              </section>
            </div>

            <div v-else-if="groupDetailTab === 'members'" class="group-members">
              <article v-for="member in selectedGroup.members || []" :key="member.id">
                <img :src="member.user?.avatar || fallbackAvatar" />
                <div><b>{{ displayName(member.user, member.user_id) }}</b><small>@{{ member.user?.username || '-' }} · 用户 ID {{ member.user_id }}</small></div>
                <span>{{ groupMemberRoleLabel(member.role) }}</span>
                <em>{{ member.state === 'active' ? '有效成员' : member.state }}</em>
                <small>加入于 {{ formatDate(member.created_at) }}</small>
              </article>
              <p v-if="!selectedGroup.members?.length" class="empty-block">暂无成员记录</p>
            </div>

            <div v-else class="group-audits">
              <article v-for="item in selectedGroup.audits || []" :key="item.id">
                <div><b>{{ auditActionLabel(item.action) }}</b><small>{{ formatDate(item.created_at) }} · 日志 #{{ item.id }}</small></div>
                <p>{{ item.reason }}</p>
                <dl><dt>管理员</dt><dd>{{ displayName(item.admin, item.admin_id) }}</dd><dt>变更详情</dt><dd><code>{{ compactFilters(item.filters) }}</code></dd><dt>来源 IP</dt><dd>{{ item.source_ip || '-' }}</dd></dl>
              </article>
              <p v-if="!selectedGroup.audits?.length" class="empty-block">该群暂无管理员操作日志</p>
            </div>
          </section>
        </div>
      </template>

      <template v-else-if="section === 'online'">
        <section class="summary-grid"><div class="summary-card"><small>IM 服务</small><b class="healthy">正常</b><span>当前管理员会话已通过验证</span></div><div class="summary-card"><small>实时在线用户</small><b>{{ dashboard.online_users || 0 }}</b><span>至少保持一条 WebSocket 连接</span></div></section>
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
  { key: 'dashboard', label: '数据大屏', title: 'IM 数据大屏', description: '用户、会话、消息与安全待办的实时概览' },
  { key: 'users', label: '用户管理', title: 'IM 用户管理', description: '查看账号资料同步、会话参与和消息活跃情况' },
  { key: 'conversations', label: '会话管理', title: '会话管理', description: '统一管理私聊与群聊，审计操作必须填写原因' },
  { key: 'audit', label: '聊天审计', title: '聊天记录审计', description: '高敏操作 · 所有查询均写入不可删除审计日志' },
  { key: 'reports', label: '举报处理', title: '消息举报处理', description: '集中查看用户提交的聊天消息举报' },
  { key: 'groups', label: '群聊管理', title: '群聊管理', description: '查看群聊详情、成员、修改记录与管理员设置' },
  { key: 'online', label: '在线状态', title: '在线状态', description: '查看即时通讯服务与实时链路状态' },
  { key: 'logs', label: '操作日志', title: '管理员操作日志', description: '追踪所有高敏查询与内容处置行为' },
  { key: 'settings', label: '系统设置', title: '系统设置', description: '查看 IM 数据与功能策略' }
]
const section = ref('dashboard'), me = ref(null), rows = ref([]), reports = ref([]), groups = ref([])
const dashboard = ref({}), users = ref([]), conversations = ref([]), audits = ref([]), selectedUser = ref(null)
const userKeyword = ref(''), conversationType = ref('all'), auditAction = ref('')
const reason = ref(''), loading = ref(false), error = ref(''), feedback = ref('')
const reportStatus = ref('pending'), selectedReport = ref(null), resolutionReason = ref(''), resolving = ref(false), confirmAction = ref('')
const reportFilters = [{ key:'pending', label:'待处理' }, { key:'resolved', label:'已处理' }, { key:'rejected', label:'已驳回' }, { key:'all', label:'全部' }]
const query = reactive({ conversation_id: '', user_id: '', keyword: '' })
const selectedGroup = ref(null), groupDetailTab = ref('overview'), groupDetailLoading = ref(false), groupSaving = ref(false), groupDetailError = ref('')
const groupEdit = reactive({ name: '', member_limit: 100, reason: '' })
const groupOriginal = ref({ name: '', member_limit: 100 })
const currentSection = computed(() => navigation.find(item => item.key === section.value) || navigation[0])
const communityAdminUrl = computed(() => `${String(me.value?.community_url || 'https://54188.xyz').replace(/\/$/, '')}/admin`)
const dashboardCards = computed(() => [
  { icon:'人', label:'IM 用户', value:dashboard.value.users || 0, note:'已同步账号资料' },
  { icon:'聊', label:'全部会话', value:dashboard.value.conversations || 0, note:`其中群聊 ${dashboard.value.groups || 0}` },
  { icon:'信', label:'历史消息', value:dashboard.value.messages || 0, note:`今日新增 ${dashboard.value.today_messages || 0}` },
  { icon:'!', label:'待处理举报', value:dashboard.value.pending_reports || 0, note:'需要管理员核查' }
])
const exceptionGroupCount = computed(() => groups.value.filter(group => Number(group.member_limit) > 100).length)
const groupDirty = computed(() => groupEdit.name.trim() !== groupOriginal.value.name || Number(groupEdit.member_limit) !== Number(groupOriginal.value.member_limit))
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
const loadDashboard = async () => { dashboard.value = await api('/admin/dashboard') }
const loadUsers = async () => { users.value = await api(`/admin/users?keyword=${encodeURIComponent(userKeyword.value.trim())}`) }
const loadConversations = async () => { conversations.value = await api(`/admin/conversations?type=${conversationType.value}`) }
const loadAudits = async () => { audits.value = await api(`/admin/audits?action=${encodeURIComponent(auditAction.value)}`) }
const search = async () => { loading.value = true; error.value = ''; try { rows.value = await api('/admin/messages/search', { method: 'POST', body: JSON.stringify({ ...query, reason: reason.value.trim() }) }) } catch (e) { error.value = e.message } finally { loading.value = false } }
const loadReports = async () => { reports.value = await api('/admin/reports'); selectedReport.value = null }
const loadGroups = async () => { groups.value = await api('/admin/groups') }
const openSection = async key => { section.value = key; error.value = ''; try { if (['dashboard', 'online'].includes(key)) await loadDashboard(); if (key === 'users') await loadUsers(); if (key === 'conversations') await loadConversations(); if (key === 'reports') await loadReports(); if (key === 'groups') await loadGroups(); if (key === 'logs') await loadAudits() } catch (e) { error.value = e.message } }
const selectUser = async user => { error.value = ''; try { selectedUser.value = await api(`/admin/users/${user.id}`) } catch (e) { error.value = e.message } }
const auditConversation = item => { query.conversation_id = String(item.id); section.value = 'audit'; reason.value = '' }
const openReportFromDashboard = async report => { section.value = 'reports'; await loadReports(); await selectReport(report) }
const syncGroupForm = group => {
  groupEdit.name = group.name || ''
  groupEdit.member_limit = Number(group.member_limit) || 100
  groupEdit.reason = ''
  groupOriginal.value = { name: groupEdit.name, member_limit: groupEdit.member_limit }
}
const openGroupDetail = async group => {
  groupDetailLoading.value = true
  groupDetailError.value = ''
  try {
    selectedGroup.value = await api(`/admin/groups/${group.conversation_id}`)
    groupDetailTab.value = 'overview'
    syncGroupForm(selectedGroup.value)
  } catch (e) { error.value = e.message } finally { groupDetailLoading.value = false }
}
const closeGroupDetail = () => { if (!groupSaving.value) selectedGroup.value = null }
const saveGroupDetail = async () => {
  if (!selectedGroup.value || !groupDirty.value) return
  groupSaving.value = true
  groupDetailError.value = ''
  try {
    await api(`/admin/groups/${selectedGroup.value.conversation_id}`, { method: 'PATCH', body: JSON.stringify({ name: groupEdit.name.trim(), member_limit: Number(groupEdit.member_limit), reason: groupEdit.reason.trim() }) })
    await loadGroups()
    selectedGroup.value = await api(`/admin/groups/${selectedGroup.value.conversation_id}`)
    syncGroupForm(selectedGroup.value)
    feedback.value = '群聊资料已保存，完整变更已写入审计日志'
  } catch (e) { groupDetailError.value = e.message } finally { groupSaving.value = false }
}
const auditSelectedGroup = () => {
  query.conversation_id = String(selectedGroup.value.conversation_id)
  selectedGroup.value = null
  section.value = 'audit'
  reason.value = ''
}
const selectReport = async row => { error.value = ''; try { selectedReport.value = await api(`/admin/reports/${row.id}`); resolutionReason.value = selectedReport.value.resolution_reason || '' } catch (e) { error.value = e.message } }
const closeReport = () => { if (!resolving.value) { selectedReport.value = null; confirmAction.value = '' } }
const askAction = action => { if (canResolve.value) confirmAction.value = action }
const resolveReport = async () => { const action = confirmAction.value; resolving.value = true; error.value = ''; feedback.value = ''; try { const result = await api(`/admin/reports/${selectedReport.value.id}`, { method:'PATCH', body:JSON.stringify({ action, reason:resolutionReason.value.trim() }) }); feedback.value = ({ reject:'举报已驳回', confirm:'已确认内容违规', delete_message:'违规消息已删除', delete_and_disable:'违规消息已删除，用户已同步禁用' })[action] || '处置完成'; confirmAction.value = ''; selectedReport.value = null; await loadReports(); return result } catch (e) { confirmAction.value = ''; error.value = e.message } finally { resolving.value = false } }
const statusLabel = status => ({ pending:'待处理', resolved:'已处理', rejected:'已驳回' }[status] || status)
const actionLabel = action => ({ reject:'驳回举报', confirm:'确认违规', delete_message:'已删除违规消息', delete_and_disable:'已删除消息并禁用用户' }[action] || (action ? action : '尚未处置'))
const readableMessage = item => item?.status === 'hidden' ? '该消息因违规已被管理员删除（原始证据已保留）' : item?.type === 'image' ? '[图片消息]' : (item?.content || '消息内容为空')
const messagePreview = item => { const value = readableMessage(item); return value.length > 80 ? `${value.slice(0, 80)}…` : value }
const displayName = (user, id) => user?.nickname || user?.username || `用户 ${id}`
const roleLabel = role => ({ superadmin:'超级管理员', admin:'管理员', moderator:'版主', reviewer:'审核员', user:'普通用户' }[role] || role || '普通用户')
const auditActionLabel = action => ({ 'messages.search':'聊天检索', 'report.reject':'驳回举报', 'report.confirm':'确认违规', 'report.delete_message':'删除违规消息', 'report.delete_and_disable':'删除消息并禁用账号', 'group.member_limit.update':'调整群容量', 'group.profile.update':'修改群聊资料' }[action] || action)
const groupMemberRoleLabel = role => ({ owner:'群主', admin:'群管理员', member:'普通成员' }[role] || role)
const compactFilters = filters => { if (!filters) return '-'; const value = typeof filters === 'string' ? filters : JSON.stringify(filters); return value.length > 100 ? `${value.slice(0, 100)}…` : value }
const communityUserUrl = user => `${String(me.value?.community_url || 'https://54188.xyz').replace(/\/$/, '')}/user/${user.codemao_user_id || user.id}`
const fallbackAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="80" height="80" rx="40" fill="%23fff4cf"/%3E%3Ctext x="40" y="49" text-anchor="middle" font-size="22" fill="%23a86f00"%3E狗%3C/text%3E%3C/svg%3E'
const formatDate = value => value ? new Date(value).toLocaleString('zh-CN') : '-'
onMounted(() => api('/me').then(async value => { me.value = value; if (!['admin', 'superadmin'].includes(value.role)) error.value = '当前账号无权访问 IM 后台'; else await loadDashboard() }).catch(e => { error.value = e.message }))
</script>

<style scoped>
.dashboard-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin-bottom:18px; }
.dashboard-card { display:flex; align-items:center; gap:15px; min-height:126px; padding:20px; border:1px solid #e3e7ed; border-radius:16px; background:#fff; box-shadow:0 10px 28px rgba(31,35,41,.055); }
.dashboard-card:nth-child(1),.dashboard-card:nth-child(4) { background:linear-gradient(135deg,#fffaf0,#fff); border-color:#ecdcae; }
.dashboard-card>span { display:grid; width:44px; height:44px; flex:none; place-items:center; border-radius:13px; background:#fff7dc; color:#a86f00; font-size:18px; font-weight:900; }
.dashboard-card>div { display:grid; gap:4px; }.dashboard-card small,.dashboard-card em { color:#969ca5; font-size:11px; font-style:normal; }.dashboard-card b { color:#172033; font-size:29px; line-height:1; }
.dashboard-columns { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(300px,.7fr); gap:18px; }.panel { overflow:hidden; border:1px solid var(--border); border-radius:15px; background:#fff; box-shadow:0 10px 28px rgba(31,35,41,.05); }.panel-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:17px 19px; border-bottom:1px solid var(--border); }.panel-head>div { display:grid; gap:4px; }.panel-head small { color:#969ca5; }.health-badge { padding:5px 9px; border-radius:7px; background:#edf9e9; color:#39813d; font-size:11px; }.activity-list button { display:flex; width:100%; align-items:center; gap:11px; padding:14px 18px; border:0; border-bottom:1px solid #eef0f2; background:#fff; text-align:left; cursor:pointer; }.activity-list button:hover { background:#fffaf0; }.activity-list button>div { display:grid; min-width:0; flex:1; gap:4px; }.activity-list button small { overflow:hidden; color:#9298a1; text-overflow:ellipsis; white-space:nowrap; }.activity-list button em { color:#8b919a; font-size:11px; font-style:normal; }.activity-dot { width:8px; height:8px; flex:none; border-radius:50%; background:#b8bdc5; }.dot-pending { background:#f2ae16; }.dot-resolved { background:#5ab565; }.empty-block { padding:42px; color:#a0a5ad; text-align:center; }.health-list { padding:8px 19px; }.health-list p { display:flex; align-items:center; justify-content:space-between; margin:0; padding:15px 0; border-bottom:1px solid #eef0f2; }.health-list p:last-child { border-bottom:0; }.health-list span { color:#7f858e; }.health-list b { color:#30343a; }
.management-toolbar { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:18px 20px; border:1px solid var(--border); border-radius:14px; background:#fff; box-shadow:0 8px 24px rgba(31,35,41,.05); }.management-toolbar>div { display:grid; gap:5px; }.management-toolbar>div span { color:#969ca5; font-size:11px; }.management-toolbar label { display:flex; }.management-toolbar input,.management-toolbar select { width:270px; height:39px; border:1px solid #dfe2e7; border-radius:9px 0 0 9px; background:#fafafa; padding:0 11px; outline:none; }.management-toolbar label button { padding:0 17px; border:0; border-radius:0 9px 9px 0; background:#fec433; color:#292d32; font-weight:800; cursor:pointer; }.management-toolbar .select-label { display:grid; gap:6px; color:#7f858e; font-size:11px; }.management-toolbar .select-label select { width:170px; border-radius:9px; background:#fff; }.user-cell { display:flex; align-items:center; gap:10px; }.user-cell img { width:38px; height:38px; flex:none; border-radius:50%; object-fit:cover; box-shadow:0 0 0 2px #fff,0 3px 10px rgba(31,35,41,.12); }.user-cell span { display:grid; gap:2px; }.member-stack { display:flex; align-items:center; }.member-stack img { width:27px; height:27px; margin-left:-7px; border:2px solid #fff; border-radius:50%; object-fit:cover; }.member-stack img:first-child { margin-left:0; }.member-stack span { margin-left:8px; color:#7f858e; }.link-action { margin-left:6px; border:0; background:transparent; color:#a86f00; font-size:11px; cursor:pointer; }.user-dialog { width:min(680px,94vw); overflow:hidden; border-radius:17px; background:#fff; box-shadow:0 24px 70px rgba(0,0,0,.22); }.user-dialog>header { margin:0; padding:22px 24px; border-bottom:1px solid var(--border); }.user-dialog h2 { margin:0; font-size:20px; }.user-dialog .user-cell img { width:52px; height:52px; }.user-detail-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:20px 24px; }.user-detail-grid>div { display:grid; gap:6px; padding:14px; border:1px solid #e8ebef; border-radius:11px; background:#fafafa; }.user-detail-grid small { color:#9298a1; }.user-detail-grid b { font-size:18px; }.user-dialog-note { margin:0 24px 20px; padding:15px 17px; border-left:4px solid #fec433; border-radius:9px; background:#fff9e6; }.user-dialog-note p { margin:7px 0 0; color:#7b6d4a; line-height:1.7; }.user-dialog>footer { display:flex; justify-content:flex-end; gap:9px; padding:16px 24px; border-top:1px solid var(--border); }.user-dialog>footer a { padding:9px 13px; border:1px solid #e0e3e8; border-radius:8px; color:#6f737a; text-decoration:none; }.user-dialog>footer a:last-child { border-color:#fec433; background:#fec433; color:#24272b; font-weight:700; }.records code { color:#667085; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:10px; }
.summary-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:18px; }
.summary-card,.info-card { border:1px solid var(--border); border-radius:14px; background:#fff; box-shadow:0 8px 24px rgba(31,35,41,.05); }
.summary-card { display:grid; gap:7px; padding:20px; }.summary-card small,.summary-card span,.info-card p,.setting-row small{color:#9298a1}.summary-card b{font-size:28px}.summary-card .healthy{color:#38a169}
.table-action { padding:7px 10px; border:0; border-radius:8px; background:#ffc43d; color:#14181e; font-weight:800; cursor:pointer }
.tag.exception{color:#c24141;background:#fff0f0}.info-card{padding:22px}.info-card h2{margin:0 0 8px}.setting-row{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid var(--border)}.setting-row:last-child{border-bottom:0}.setting-row span{display:grid;gap:5px}.setting-row strong{color:#a86f00}
.group-detail-dialog{width:min(980px,96vw);max-height:92vh;overflow:auto;border:1px solid #e3e7ed;border-radius:18px;background:#f7f8fa;box-shadow:0 28px 80px rgba(14,21,34,.28)}
.group-detail-dialog>header{position:sticky;z-index:4;top:0;display:flex;align-items:center;justify-content:space-between;margin:0;padding:20px 24px;border-bottom:1px solid #e5e8ed;background:rgba(255,255,255,.96);backdrop-filter:blur(12px)}
.group-detail-title{display:flex;align-items:center;gap:14px}.group-detail-title>span{display:grid;width:52px;height:52px;place-items:center;border-radius:15px;background:linear-gradient(145deg,#ffd45d,#ffb719);color:#202631;font-size:22px;font-weight:900;box-shadow:0 9px 22px rgba(230,165,0,.2)}.group-detail-title>div{display:grid;gap:2px}.group-detail-title small{color:#b47b00}.group-detail-title h2{margin:0;color:#172033;font-size:22px}.group-detail-title p{margin:0;color:#969ca5;font-size:11px}
.group-detail-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px 24px 0}.group-detail-stats>div{display:grid;gap:6px;padding:14px 16px;border:1px solid #e3e7ed;border-radius:11px;background:#fff}.group-detail-stats small{color:#969ca5}.group-detail-stats b{color:#202735;font-size:17px}
.group-detail-tabs{display:flex;gap:4px;margin:18px 24px 0;padding:4px;border:1px solid #e1e5ea;border-radius:11px;background:#fff}.group-detail-tabs button{min-height:36px;padding:0 17px;border:0;border-radius:8px;background:transparent;color:#747b86;font-weight:700;cursor:pointer}.group-detail-tabs button.active{background:#172033;color:#fff;box-shadow:0 5px 13px rgba(23,32,51,.18)}
.group-detail-error{margin:14px 24px 0;padding:10px 13px;border:1px solid #f1b4b4;border-radius:9px;background:#fff3f3;color:#c23f3f}
.group-overview{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(250px,.65fr);gap:14px;padding:16px 24px 24px}.group-edit-card,.group-info-card{border:1px solid #e2e6eb;border-radius:13px;background:#fff}.group-edit-card{padding:18px}.group-edit-card>div h3,.group-info-card h3{margin:0 0 5px}.group-edit-card>div p{margin:0 0 18px;color:#9298a1;font-size:12px}.group-edit-card label{display:grid;grid-template-columns:100px 1fr;align-items:start;gap:7px 12px;margin-top:13px}.group-edit-card label>span{padding-top:10px;color:#5f6670;font-weight:700}.group-edit-card input,.group-edit-card textarea{width:100%;box-sizing:border-box;border:1px solid #dfe3e8;border-radius:9px;background:#fbfbfc;color:#242a34;padding:10px 12px;outline:none}.group-edit-card textarea{min-height:90px;resize:vertical}.group-edit-card input:focus,.group-edit-card textarea:focus{border-color:#eab42a;box-shadow:0 0 0 3px rgba(254,196,51,.14)}.group-edit-card label small{grid-column:2;color:#9ba0a8}.group-reason{position:relative}.group-reason small{justify-self:end}.group-edit-card footer{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:18px;padding-top:15px;border-top:1px solid #edf0f2}.group-edit-card footer span{margin-right:auto;color:#9ba0a8;font-size:11px}.group-edit-card footer button{min-height:39px;padding:0 17px;border:0;border-radius:8px;background:#ffc43d;color:#171c25;font-weight:800;cursor:pointer}.group-edit-card footer button:disabled{opacity:.45;cursor:not-allowed}
.group-info-card{align-self:start;padding:18px}.group-info-card p{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0;padding:13px 0;border-bottom:1px solid #edf0f2}.group-info-card p span{color:#898f98}.group-info-card code{color:#384152}.group-info-card button{width:100%;margin-top:16px}
.group-members,.group-audits{display:grid;gap:9px;padding:16px 24px 24px}.group-members article{display:grid;grid-template-columns:44px minmax(160px,1fr) 100px 100px 180px;align-items:center;gap:12px;padding:12px 14px;border:1px solid #e3e7ec;border-radius:11px;background:#fff}.group-members img{width:42px;height:42px;border-radius:50%;object-fit:cover}.group-members article>div{display:grid;gap:3px}.group-members article small{color:#999fa8}.group-members article>span{justify-self:start;padding:4px 8px;border-radius:6px;background:#fff5d8;color:#9b6a00;font-size:11px;font-style:normal}.group-members article>em{color:#448b49;font-size:11px;font-style:normal}
.group-audits article{display:grid;grid-template-columns:180px minmax(180px,.8fr) minmax(300px,1.3fr);gap:15px;padding:15px;border:1px solid #e3e7ec;border-radius:11px;background:#fff}.group-audits article>div{display:grid;align-content:start;gap:4px}.group-audits small{color:#9ba0a8}.group-audits p{margin:0;line-height:1.6}.group-audits dl{display:grid;grid-template-columns:70px 1fr;gap:5px 9px;margin:0}.group-audits dt{color:#9ba0a8}.group-audits dd{min-width:0;margin:0;overflow-wrap:anywhere}.group-audits code{font-size:10px}
.header-actions{display:flex;align-items:center;gap:10px}.header-actions>a{padding:9px 13px;border:1px solid var(--border);border-radius:9px;background:#fff;color:#a86f00;text-decoration:none;font-size:12px}.header-actions>a:hover{border-color:var(--primary);background:var(--light)}
.report-toolbar{display:flex;justify-content:space-between;align-items:end;padding:16px 18px;border:1px solid var(--border);border-radius:13px;background:#fff;box-shadow:0 8px 24px rgba(31,35,41,.04)}.report-toolbar label{display:grid;gap:6px;color:#7f858e;font-size:11px}.report-toolbar select{min-width:150px;height:38px;border:1px solid #dfe2e7;border-radius:8px;background:#fafafa;padding:0 10px}.report-toolbar span{color:#9a9fa7;font-size:12px}
.report-toolbar>div{display:grid;gap:5px}.report-toolbar>div span{font-size:12px}.report-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.report-summary button{display:flex;justify-content:space-between;align-items:center;padding:15px 17px;border:1px solid var(--border);border-radius:12px;background:#fff;color:#747a83;cursor:pointer}.report-summary button b{font-size:20px;color:#2e3238}.report-summary button.active{border-color:#efc04d;background:#fff9e6;box-shadow:inset 3px 0 #fec433}.message-state{display:inline-block;margin-right:8px;padding:3px 6px;border-radius:5px;background:#edf9e9;color:#3d8c46;font-size:10px}.message-state.deleted{background:#fff0f0;color:#ca4646}.tag-pending{background:#fff7db;color:#ad7500}.tag-resolved{background:#edf9e9;color:#378742}.tag-rejected{background:#f2f3f5;color:#747a83}.feedback{padding:11px 14px;border:1px solid #bee0b5;border-radius:9px;background:#f1faee;color:#39813d}
.modal-mask{position:fixed;z-index:80;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(20,24,30,.5);backdrop-filter:blur(3px)}.report-dialog{width:min(1040px,96vw);max-height:92vh;overflow:auto;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.22)}.report-dialog>header{position:sticky;top:0;z-index:2;margin:0;padding:20px 24px;border-bottom:1px solid var(--border);background:#fff}.report-dialog>header small{color:#b37a00}.report-dialog h2{margin:4px 0 0;font-size:21px}.dialog-close{width:34px;height:34px;border:1px solid var(--border);border-radius:50%;background:#fff;color:#777;font-size:22px;cursor:pointer}.report-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:20px 24px 0}.report-meta>div{display:grid;gap:5px;padding:13px;border:1px solid #eceef1;border-radius:10px;background:#fafafa}.report-meta span,.report-meta small{color:#9298a1;font-size:11px}.reason-card{margin:14px 24px;padding:14px 16px;border-left:4px solid #fec433;border-radius:8px;background:#fff9e6}.reason-card span{font-size:11px;color:#9a7d3b}.reason-card p{margin:7px 0 0}.evidence{margin:0 24px;border:1px solid var(--border);border-radius:12px;overflow:hidden}.evidence-title{display:flex;justify-content:space-between;padding:13px 15px;background:#fafafa}.evidence-title span{font-size:11px;color:#9298a1}.message-list{display:grid;gap:8px;padding:14px;max-height:290px;overflow:auto}.message-list article{position:relative;display:grid;grid-template-columns:170px 1fr;gap:12px;padding:11px 13px;border:1px solid #eceef1;border-radius:9px}.message-list article.reported{border:2px solid #ef6868;background:#fff6f6}.message-list article.removed{background:#f7f7f7}.message-list article div{display:grid;gap:4px}.message-list article small{color:#a0a5ad}.message-list article p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.message-list article>span{position:absolute;right:9px;top:-10px;padding:2px 7px;border-radius:8px;background:#e94f4f;color:#fff;font-size:10px}.empty-context{text-align:center;color:#aaa}.decision{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;padding:16px 24px}.decision label{display:grid;gap:7px}.decision label>span{font-weight:700}.decision label i{float:right;color:#aaa;font-style:normal;font-weight:400}.decision textarea{min-height:90px;resize:vertical;border:1px solid #dfe2e7;border-radius:10px;padding:12px;outline:none}.decision textarea:focus{border-color:#fec433}.decision-tip{display:grid;align-content:center;gap:7px;padding:14px;border-radius:10px;background:#fff7e1;color:#8b6921}.decision-tip span{font-size:11px;line-height:1.7}.handled{margin:16px 24px;padding:15px;border:1px solid #bee0b5;border-radius:10px;background:#f1faee}.handled p{margin:8px 0}.handled span{color:#758079;font-size:11px}.report-dialog>footer{display:flex;justify-content:flex-end;gap:9px;padding:15px 24px 21px;border-top:1px solid var(--border)}.report-dialog button,.confirm-dialog button{min-height:38px;padding:0 14px;border-radius:8px;font-weight:700;cursor:pointer}.plain{border:1px solid #dfe2e7;background:#fff;color:#5f6670}.warning{border:0;background:#fec433;color:#24272b}.danger-outline{border:1px solid #ef9a9a;background:#fff;color:#d74343}.danger{border:0;background:#e95353;color:#fff}.report-dialog button:disabled{opacity:.42;cursor:not-allowed}.confirm-mask{z-index:100}.confirm-dialog{width:min(430px,92vw);padding:25px;border-radius:16px;background:#fff;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25)}.confirm-icon{width:46px;height:46px;margin:auto;border-radius:50%;background:#fff0db;color:#d88c00;font-size:28px;font-weight:900;line-height:46px}.confirm-dialog h3{margin:14px 0 8px}.confirm-dialog p{color:#777;line-height:1.7}.confirm-dialog>div:last-child{display:flex;justify-content:center;gap:10px;margin-top:20px}
@media(max-width:1050px){.dashboard-grid{grid-template-columns:1fr 1fr}.dashboard-columns{grid-template-columns:1fr}.report-meta{grid-template-columns:1fr 1fr}.group-overview{grid-template-columns:1fr}.group-info-card{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.group-info-card h3,.group-info-card button{grid-column:1/-1}.group-info-card p{display:grid}.group-audits article{grid-template-columns:150px 1fr}.group-audits dl{grid-column:1/-1}}@media(max-width:850px){.dashboard-grid{grid-template-columns:1fr}.management-toolbar{align-items:stretch;flex-direction:column}.management-toolbar label,.management-toolbar input{width:100%}.user-detail-grid{grid-template-columns:1fr 1fr}.summary-grid{grid-template-columns:1fr}.report-summary{grid-template-columns:1fr 1fr}.decision{grid-template-columns:1fr}.message-list article{grid-template-columns:1fr}.report-dialog>footer{flex-wrap:wrap}.group-detail-stats{grid-template-columns:1fr 1fr}.group-members article{grid-template-columns:44px 1fr 90px}.group-members article>small{grid-column:2/-1}.group-overview,.group-members,.group-audits{padding-left:14px;padding-right:14px}.group-detail-tabs{margin-left:14px;margin-right:14px;overflow-x:auto}.group-edit-card label{grid-template-columns:1fr}.group-edit-card label>span{padding:0}.group-edit-card label small{grid-column:1}.group-audits article{grid-template-columns:1fr}.group-audits dl{grid-column:auto}.group-info-card{grid-template-columns:1fr}}
</style>

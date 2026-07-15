<template>
  <main class="terminal-shell">
    <aside class="rail">
      <div class="brand"><span class="brand-mark">狗</span><div><b>编程狗消息</b><small>即时通讯</small></div></div>
      <label class="search"><span>⌕</span><input v-model="filter" placeholder="搜索会话" /></label>
      <div class="rail-title"><span>消息列表</span><button title="新建会话" @click="createPanel = !createPanel">＋</button></div>
      <div v-if="createPanel" class="create-panel">
        <form @submit.prevent="createDirect"><input v-model="peerId" inputmode="numeric" placeholder="对方用户 ID" /><button>私聊</button></form>
        <form @submit.prevent="createGroup"><input v-model="groupName" maxlength="50" placeholder="新群名称" /><button>建群</button></form>
      </div>
      <div v-if="requests.length" class="requests"><small>私聊申请</small><div v-for="request in requests" :key="request.conversation_id"><span>用户 {{ request.from_user_id }}</span><button @click="handleRequest(request, 'accept')">接受</button><button class="ghost" @click="handleRequest(request, 'reject')">拒绝</button></div></div>
      <button v-for="item in filteredConversations" :key="item.id" class="conversation" :class="{ active: selected?.id === item.id }" @click="selectConversation(item)">
        <span class="avatar">{{ item.type === 'group' ? '群' : '友' }}</span>
        <span class="conversation-copy"><b>{{ item.title || `会话 #${item.id}` }}</b><small>序列 {{ item.last_sequence || 0 }}</small></span>
      </button>
      <div v-if="!conversations.length" class="empty">还没有会话<br><small>从编程狗用户主页发起私聊</small></div>
      <div class="account"><span class="avatar user">{{ initials }}</span><div><b>{{ me?.nickname || me?.username || '连接中' }}</b><small><em></em> 安全在线</small></div></div>
    </aside>

    <section class="channel">
      <header><div><small>即时消息</small><h1>{{ selected ? (selected.type === 'group' ? `群组 #${selected.id}` : `私聊 #${selected.id}`) : '选择一个会话' }}</h1></div><div class="signal"><span></span><span></span><span></span></div></header>
      <div ref="timeline" class="timeline">
        <div v-if="loading" class="center-state">正在加载消息…</div>
        <div v-else-if="!selected" class="welcome"><div class="orb">聊</div><h2>欢迎使用编程狗消息</h2><p>选择左侧会话，开始安全、可靠的即时交流。</p></div>
        <article v-for="message in messages" :key="message.id" class="message" :class="{ mine: Number(message.sender_id) === Number(me?.id) }">
          <span class="avatar">{{ Number(message.sender_id) === Number(me?.id) ? initials : '友' }}</span>
          <div><div class="message-meta"><b>{{ Number(message.sender_id) === Number(me?.id) ? '我' : `用户 ${message.sender_id}` }}</b><time>{{ formatTime(message.created_at) }}</time><code>#{{ message.sequence }}</code></div><a v-if="message.type === 'image'" :href="imageData(message).url" target="_blank" rel="noopener"><img class="message-image" :src="imageData(message).url" alt="聊天图片" referrerpolicy="no-referrer" /></a><p v-else>{{ message.content }}</p></div>
        </article>
      </div>
      <form class="composer" @submit.prevent="sendMessage">
        <textarea v-model="draft" :disabled="!selected" maxlength="10000" placeholder="输入消息，Enter 发送，Shift + Enter 换行" @keydown.enter.exact.prevent="sendMessage"></textarea>
        <footer><span>{{ socketState }}</span><div><label class="image-button">图片<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" :disabled="!selected || sending" @change="sendImage" /></label><button :disabled="!selected || !draft.trim() || sending">{{ sending ? '发送中' : '发送' }} <b>↗</b></button></div></footer>
      </form>
    </section>

    <aside class="intel">
      <div class="radar"><span></span></div><small>服务状态</small><h3>{{ selected ? '连接正常' : '等待会话' }}</h3>
      <dl><div><dt>安全传输</dt><dd>已开启</dd></div><div><dt>消息数量</dt><dd>{{ selected?.last_sequence || 0 }}</dd></div><div><dt>实时连接</dt><dd>正常</dd></div></dl>
      <div class="notice"><b>安全提示</b><p>请勿在聊天中发送密码、令牌或其他敏感凭据。</p></div>
    </aside>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const me = ref(null), conversations = ref([]), requests = ref([]), selected = ref(null), messages = ref([])
const filter = ref(''), draft = ref(''), loading = ref(false), sending = ref(false), socketState = ref('正在连接'), timeline = ref(null)
const createPanel = ref(false), peerId = ref(''), groupName = ref('')
let socket = null
const initials = computed(() => String(me.value?.nickname || me.value?.username || '犬').slice(0, 1))
const filteredConversations = computed(() => conversations.value.filter(item => String(item.id).includes(filter.value.trim())))
const api = async (url, options = {}) => {
  const response = await fetch(`/im/api${url}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options })
  const body = await response.json(); if (!response.ok) throw new Error(body.msg || '请求失败'); return body.data
}
const exchangeSso = async () => {
  const params = new URLSearchParams(location.search), ticket = params.get('ticket')
  if (!ticket) return
  await api('/auth/sso/exchange', { method: 'POST', body: JSON.stringify({ ticket }) })
  history.replaceState({}, '', location.pathname)
}
const refreshSidebar = async () => { [conversations.value, requests.value] = await Promise.all([api('/conversations'), api('/conversation-requests')]) }
const load = async () => { await exchangeSso(); me.value = await api('/me'); await refreshSidebar(); connectSocket() }
const createDirect = async () => { if (!peerId.value) return; await api('/conversations/direct', { method:'POST', body:JSON.stringify({ user_id:Number(peerId.value) }) }); peerId.value=''; createPanel.value=false; await refreshSidebar() }
const createGroup = async () => { if (!groupName.value.trim()) return; await api('/conversations/group', { method:'POST', body:JSON.stringify({ name:groupName.value.trim() }) }); groupName.value=''; createPanel.value=false; await refreshSidebar() }
const handleRequest = async (request, action) => { await api(`/conversation-requests/${request.conversation_id}`, { method:'POST', body:JSON.stringify({ action }) }); await refreshSidebar() }
const selectConversation = async item => { selected.value = item; loading.value = true; try { messages.value = await api(`/conversations/${item.id}/messages`); await nextTick(); timeline.value?.scrollTo(0, timeline.value.scrollHeight) } finally { loading.value = false } }
const sendMessage = async () => {
  if (!selected.value || !draft.value.trim() || sending.value) return
  const content = draft.value.trim(); draft.value = ''; sending.value = true
  try { await api('/messages', { method: 'POST', body: JSON.stringify({ conversation_id: selected.value.id, client_message_id: crypto.randomUUID(), content }) }) }
  catch (error) { draft.value = content; alert(error.message) } finally { sending.value = false }
}
const sendImage = async event => {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file || !selected.value || sending.value) return
  sending.value = true
  try {
    const data = new FormData(); data.append('image', file)
    const uploadResponse = await fetch('/im/api/images', { method: 'POST', credentials: 'include', body: data })
    const upload = await uploadResponse.json(); if (!uploadResponse.ok) throw new Error(upload.msg || '图片上传失败')
    await api('/messages', { method: 'POST', body: JSON.stringify({ conversation_id: selected.value.id, client_message_id: crypto.randomUUID(), type: 'image', image_id: upload.data.id }) })
  } catch (error) { alert(error.message) } finally { sending.value = false }
}
const connectSocket = () => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${protocol}//${location.host}/im/ws`)
  socket.onopen = () => { socketState.value = '实时链路在线' }
  socket.onclose = () => { socketState.value = '链路已断开'; setTimeout(connectSocket, 2000) }
  socket.onmessage = async event => { const frame = JSON.parse(event.data); if (frame.event === 'message.new' && Number(frame.data.conversation_id) === Number(selected.value?.id) && !messages.value.some(item => String(item.id) === String(frame.data.id))) { messages.value.push(frame.data); await nextTick(); timeline.value?.scrollTo(0, timeline.value.scrollHeight) } }
}
const formatTime = value => value ? new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
const imageData = message => { try { return JSON.parse(message.content) } catch { return { url: '' } } }
onMounted(() => load().catch(error => { socketState.value = error.message }))
onUnmounted(() => socket?.close())
</script>
<style scoped>
.message-image { display:block; max-width:min(420px,60vw); max-height:360px; margin-top:8px; border:1px solid #e2e4e8; border-radius:5px 15px 15px 15px; object-fit:contain; background:#fff; }
.composer footer > div { display:flex; gap:8px; }
.image-button { display:inline-flex; align-items:center; border:1px solid #dfe2e8; border-radius:9px; padding:8px 12px; color:#666b73; background:#fafafa; cursor:pointer; }
.image-button input { display:none; }
.create-panel { display:grid; gap:8px; padding:0 6px 10px; }
.create-panel form { display:flex; gap:6px; }
.create-panel input { min-width:0; flex:1; height:32px; border:1px solid #dfe2e8; border-radius:7px; background:#fafafa; color:#30343a; padding:0 9px; }
.create-panel button,.requests button { border:0; border-radius:7px; background:#ffc43d; color:#111820; font-weight:700; padding:0 9px; cursor:pointer; }
.requests { margin:4px 6px 10px; padding:10px; border:1px solid #f0d27c; border-radius:9px; background:#fff9e6; }
.requests > small { color:#b77a00; }
.requests > div { display:grid; grid-template-columns:1fr auto auto; gap:5px; align-items:center; margin-top:8px; font-size:11px; }
.requests button { height:25px; font-size:10px; }
.requests button.ghost { background:#fff; color:#7d828a; border:1px solid #dfe2e8; }
</style>

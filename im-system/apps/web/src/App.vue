<template>
  <main class="terminal-shell">
    <aside class="rail">
      <div class="brand"><span class="brand-mark">CD</span><div><b>编程狗通讯</b><small>ORBIT LINK</small></div></div>
      <label class="search"><span>⌕</span><input v-model="filter" placeholder="搜索会话" /></label>
      <div class="rail-title"><span>通讯频道</span><button title="新建会话">＋</button></div>
      <button v-for="item in filteredConversations" :key="item.id" class="conversation" :class="{ active: selected?.id === item.id }" @click="selectConversation(item)">
        <span class="avatar">{{ item.type === 'group' ? '群' : '友' }}</span>
        <span class="conversation-copy"><b>{{ item.type === 'group' ? `群组 #${item.id}` : `私聊 #${item.id}` }}</b><small>序列 {{ item.last_sequence || 0 }}</small></span>
        <i v-if="Number(item.last_sequence) > Number(item.membership?.last_read_sequence || 0)"></i>
      </button>
      <div v-if="!conversations.length" class="empty">还没有会话<br><small>从编程狗用户主页发起私聊</small></div>
      <div class="account"><span class="avatar user">{{ initials }}</span><div><b>{{ me?.nickname || me?.username || '连接中' }}</b><small><em></em> 安全在线</small></div></div>
    </aside>

    <section class="channel">
      <header><div><small>SECURE CHANNEL</small><h1>{{ selected ? (selected.type === 'group' ? `群组 #${selected.id}` : `私聊 #${selected.id}`) : '选择通讯频道' }}</h1></div><div class="signal"><span></span><span></span><span></span></div></header>
      <div ref="timeline" class="timeline">
        <div v-if="loading" class="center-state">正在同步星际链路…</div>
        <div v-else-if="!selected" class="welcome"><div class="orb">⌁</div><h2>通讯链路已就绪</h2><p>选择左侧会话，开始安全、可靠的即时交流。</p></div>
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
      <div class="radar"><span></span></div><small>CHANNEL STATUS</small><h3>{{ selected ? '链路正常' : '待命' }}</h3>
      <dl><div><dt>加密传输</dt><dd>开启</dd></div><div><dt>消息序列</dt><dd>{{ selected?.last_sequence || 0 }}</dd></div><div><dt>协议版本</dt><dd>IM/1</dd></div></dl>
      <div class="notice"><b>安全提示</b><p>请勿在聊天中发送密码、令牌或其他敏感凭据。</p></div>
    </aside>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const me = ref(null), conversations = ref([]), selected = ref(null), messages = ref([])
const filter = ref(''), draft = ref(''), loading = ref(false), sending = ref(false), socketState = ref('正在连接'), timeline = ref(null)
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
const load = async () => { await exchangeSso(); me.value = await api('/me'); conversations.value = await api('/conversations'); connectSocket() }
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
.message-image { display:block; max-width:min(420px,60vw); max-height:360px; margin-top:8px; border:1px solid #26708e; border-radius:5px 15px 15px 15px; object-fit:contain; background:#06101c; }
.composer footer > div { display:flex; gap:8px; }
.image-button { display:inline-flex; align-items:center; border:1px solid #24516c; border-radius:9px; padding:8px 12px; color:#67ddf7; cursor:pointer; }
.image-button input { display:none; }
</style>

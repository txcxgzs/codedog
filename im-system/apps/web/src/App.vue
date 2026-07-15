<template>
  <main class="terminal-shell">
    <aside class="rail">
      <div class="brand"><span class="brand-mark">狗</span><div><b>编程狗消息</b><small>即时通讯</small></div><a class="back-link" :href="communityUrl">返回编程狗</a></div>
      <form class="search" @submit.prevent="searchUsers"><span>⌕</span><input v-model="filter" placeholder="搜索用户或会话" /><button title="搜索">搜索</button></form>
      <div v-if="searchResults.length" class="search-results">
        <button v-for="user in searchResults" :key="user.id" @click="startDirect(user)"><span class="avatar">{{ avatarLetter(user) }}</span><span><b>{{ displayName(user, user.id) }}</b><small>发起私聊</small></span></button>
      </div>
      <div class="rail-title"><span>消息列表</span><button title="新建会话" @click="createPanel = !createPanel">＋</button></div>
      <div v-if="createPanel" class="create-panel">
        <form @submit.prevent="createDirect"><input v-model="peerId" inputmode="numeric" placeholder="对方用户 ID" /><button>私聊</button></form>
        <form @submit.prevent="createGroup"><input v-model="groupName" maxlength="50" placeholder="新群名称" /><button>建群</button></form>
      </div>
      <div v-if="requests.length" class="requests"><small>私聊申请</small><div v-for="request in requests" :key="request.conversation_id"><span class="user-link" @click="openUser(request.from_user)">{{ displayName(request.from_user, request.from_user_id) }}</span><button @click="handleRequest(request, 'accept')">接受</button><button class="ghost" @click="handleRequest(request, 'reject')">拒绝</button></div></div>
      <button v-for="item in filteredConversations" :key="item.id" class="conversation" :class="{ active: selected?.id === item.id }" @click="selectConversation(item)">
        <span class="avatar"><img v-if="item.type === 'direct' && item.peer?.avatar" :src="item.peer.avatar" alt="" referrerpolicy="no-referrer" @error="$event.currentTarget.remove()" />{{ item.type === 'group' ? '群' : avatarLetter(item.peer, '友') }}</span>
        <span class="conversation-copy"><b :class="{ 'user-link': item.type === 'direct' }" @click.stop="item.type === 'direct' && openUser(item.peer)">{{ item.title || `会话 #${item.id}` }}</b><small>序列 {{ item.last_sequence || 0 }}</small></span>
      </button>
      <div v-if="!conversations.length" class="empty">还没有会话<br><small>从编程狗用户主页发起私聊</small></div>
      <div class="account">
        <span class="avatar user">
          <img
            v-if="me?.avatar && !avatarFailed"
            :src="me.avatar"
            :alt="`${me?.nickname || me?.username || '当前用户'}的头像`"
            referrerpolicy="no-referrer"
            @error="avatarFailed = true"
          />
          <template v-else>{{ initials }}</template>
        </span>
        <div><b class="user-link" @click="openUser(me)">{{ me?.nickname || me?.username || '连接中' }}</b><small><em></em> 安全在线</small></div>
      </div>
    </aside>

    <section class="channel">
      <header><div><small>即时消息</small><h1>{{ selected ? (selected.title || `会话 #${selected.id}`) : '选择一个会话' }}</h1></div><div class="signal"><span></span><span></span><span></span></div></header>
      <div ref="timeline" class="timeline">
        <div v-if="loading" class="center-state">正在加载消息…</div>
        <div v-else-if="initialLoginError" class="welcome auth-failure"><div class="orb">!</div><h2>无法完成安全登录</h2><p>{{ initialLoginError }}</p><a class="reauth-button" :href="communityUrl">返回编程狗重新进入</a></div>
        <div v-else-if="!selected" class="welcome"><div class="orb">聊</div><h2>欢迎使用编程狗消息</h2><p>选择左侧会话，开始安全、可靠的即时交流。</p></div>
        <article v-for="message in messages" :key="message.id" class="message" :class="{ mine: Number(message.sender_id) === Number(me?.id) }">
          <span class="avatar"><img v-if="message.sender?.avatar" :src="message.sender.avatar" alt="" referrerpolicy="no-referrer" @error="$event.currentTarget.remove()" />{{ Number(message.sender_id) === Number(me?.id) ? initials : avatarLetter(message.sender, '友') }}</span>
          <div><div class="message-meta"><b class="user-link" @click="openUser(message.sender || (Number(message.sender_id) === Number(me?.id) ? me : null))">{{ Number(message.sender_id) === Number(me?.id) ? '我' : displayName(message.sender, message.sender_id) }}</b><time>{{ formatTime(message.created_at) }}</time><code>#{{ message.sequence }}</code><button v-if="Number(message.sender_id) !== Number(me?.id)" class="report-message" @click="openReport(message)">举报</button></div><a v-if="message.type === 'image'" :href="imageData(message).url" target="_blank" rel="noopener"><img class="message-image" :src="imageData(message).url" alt="聊天图片" referrerpolicy="no-referrer" /></a><p v-else>{{ message.content }}</p></div>
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
    <div v-if="reportDialog.open" class="modal-mask" @click.self="closeReport">
      <section class="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header><div><small>内容安全</small><h2 id="report-title">举报这条消息</h2></div><button aria-label="关闭" @click="closeReport">×</button></header>
        <p>请说明举报原因，管理员会结合聊天上下文进行审核。请勿重复提交。</p>
        <label>举报原因 <span>{{ reportDialog.reason.length }}/500</span><textarea v-model="reportDialog.reason" maxlength="500" autofocus placeholder="例如：包含辱骂、骚扰、诈骗或违规内容"></textarea></label>
        <div v-if="reportDialog.error" class="dialog-error">{{ reportDialog.error }}</div>
        <footer><button class="ghost" @click="closeReport">取消</button><button :disabled="reportDialog.reason.trim().length < 5 || reportDialog.submitting" @click="submitReport">{{ reportDialog.submitting ? '提交中' : '提交举报' }}</button></footer>
      </section>
    </div>
    <div v-if="captchaDialog.open" class="modal-mask">
      <section class="report-dialog captcha-dialog" role="dialog" aria-modal="true">
        <header><div><small>防刷验证</small><h2>请完成极验安全验证</h2></div><button aria-label="关闭" @click="cancelCaptcha">×</button></header>
        <p>{{ captchaDialog.scene === 'im_message' ? '验证通过后 2 分钟内发送消息无需重复验证。' : '本次操作完成验证后才会继续。' }}</p>
        <div ref="captchaBox" class="captcha-box"></div>
        <div v-if="captchaDialog.error" class="dialog-error">{{ captchaDialog.error }}</div>
      </section>
    </div>
    <div v-if="toast.message" :class="['toast', toast.type]">{{ toast.message }}</div>
    <div v-if="sessionExpired" class="modal-mask session-expired">
      <section class="report-dialog" role="alertdialog" aria-modal="true">
        <header><div><small>安全会话</small><h2>请从编程狗重新进入</h2></div></header>
        <p>即时通讯登录每 30 分钟失效一次，以防登录链接或会话被他人冒用。返回编程狗后再次点击“即时通讯”即可继续。</p>
        <footer><a class="reauth-button" :href="communityUrl">返回编程狗</a></footer>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'

const me = ref(null), conversations = ref([]), requests = ref([]), selected = ref(null), messages = ref([])
const filter = ref(''), draft = ref(''), loading = ref(false), sending = ref(false), socketState = ref('正在连接'), timeline = ref(null)
const createPanel = ref(false), peerId = ref(''), groupName = ref('')
const avatarFailed = ref(false)
const sessionExpired = ref(false)
const initialLoginError = ref('')
const searchResults = ref([]), captchaBox = ref(null)
const captchaDialog = reactive({ open: false, scene: '', error: '', resolve: null })
const captchaGrants = new Map()
const reportDialog = reactive({ open: false, message: null, reason: '', error: '', submitting: false })
const toast = reactive({ message: '', type: 'success' })
let socket = null
const initials = computed(() => String(me.value?.nickname || me.value?.username || '犬').slice(0, 1))
const communityUrl = computed(() => String(me.value?.community_url || 'https://54188.xyz').replace(/\/$/, ''))
const displayName = (user, fallbackId) => user?.nickname || user?.username || `用户 ${fallbackId}`
const avatarLetter = (user, fallback = '友') => String(user?.nickname || user?.username || fallback).slice(0, 1)
const showToast = (message, type = 'success') => { toast.message = message; toast.type = type; window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => { toast.message = '' }, 3200) }
const openUser = user => { if (!user?.codemao_user_id) return showToast('该用户的主页资料尚未同步，请稍后重试', 'warning'); window.open(`${communityUrl.value}/user/${encodeURIComponent(user.codemao_user_id)}`, '_blank', 'noopener') }
const filteredConversations = computed(() => {
  const keyword = filter.value.trim().toLowerCase()
  return conversations.value.filter(item => !keyword || String(item.id).includes(keyword) || String(item.title || '').toLowerCase().includes(keyword))
})
const api = async (url, options = {}) => {
  const { captchaGrant, ...requestOptions } = options
  const response = await fetch(`/im/api${url}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(captchaGrant ? { 'X-IM-Captcha-Grant': captchaGrant } : {}), ...(requestOptions.headers || {}) }, ...requestOptions })
  const body = await response.json()
  // SSO exchange itself may return 401 for configuration or binding errors.
  // Only an already established IM session should be presented as expired.
  if (response.status === 401 && me.value) sessionExpired.value = true
  if (!response.ok) throw new Error(body.msg || '请求失败')
  return body.data
}
const exchangeSso = async () => {
  const params = new URLSearchParams(location.search), ticket = params.get('ticket')
  if (!ticket) return null
  const action = params.get('action'), userId = Number(params.get('user_id')), groupId = Number(params.get('group_id'))
  await api('/auth/sso/exchange', { method: 'POST', body: JSON.stringify({ ticket }) })
  history.replaceState({}, '', location.pathname)
  return { action, userId, groupId }
}
const refreshSidebar = async () => { [conversations.value, requests.value] = await Promise.all([api('/conversations'), api('/conversation-requests')]) }
const loadGeetestScript = () => new Promise((resolve, reject) => {
  if (window.initGeetest) return resolve()
  const existing = document.querySelector('script[data-codedog-geetest]')
  if (existing) { existing.addEventListener('load', resolve, { once:true }); existing.addEventListener('error', reject, { once:true }); return }
  const script = document.createElement('script'); script.dataset.codedogGeetest = '1'; script.src = 'https://static.geetest.com/static/js/gt.0.5.0.js'; script.onload = resolve; script.onerror = reject; document.head.appendChild(script)
})
const cancelCaptcha = () => { const resolve = captchaDialog.resolve; captchaDialog.open = false; captchaDialog.resolve = null; resolve?.(null) }
const getCaptchaGrant = async scene => {
  const cached = captchaGrants.get(scene)
  if (scene === 'im_message' && cached?.expiresAt > Date.now()) return cached.token
  const config = await api(`/captcha/config?scene=${encodeURIComponent(scene)}`)
  if (!config.enabled) return ''
  const registration = await api(`/captcha/register?scene=${encodeURIComponent(scene)}`)
  await loadGeetestScript()
  const validation = await new Promise(async resolve => {
    captchaDialog.open = true; captchaDialog.scene = scene; captchaDialog.error = ''; captchaDialog.resolve = resolve
    await nextTick()
    window.initGeetest({ gt:registration.gt, challenge:registration.challenge, offline:!registration.success, new_captcha:registration.new_captcha, product:registration.product || 'popup', width:'100%' }, captcha => {
      captcha.appendTo(captchaBox.value)
      captcha.onReady(() => { if ((registration.product || 'popup') === 'bind') captcha.verify() })
      captcha.onSuccess(() => resolve(captcha.getValidate()))
      captcha.onError(() => { captchaDialog.error = '极验加载失败，请重试' })
    })
  })
  captchaDialog.open = false; captchaDialog.resolve = null
  if (!validation) throw new Error('已取消安全验证')
  const result = await api('/captcha/validate', { method:'POST', body:JSON.stringify({ scene, ...validation }) })
  const token = result.grant || ''
  if (scene === 'im_message' && token) captchaGrants.set(scene, { token, expiresAt:Date.now() + 115000 })
  return token
}
const load = async () => {
  const intent = await exchangeSso()
  if (intent?.action === 'admin') return location.replace('/im/admin/')
  me.value = await api('/me')
  const expiresIn = Number(me.value?.exp || 0) * 1000 - Date.now()
  if (expiresIn > 0) window.setTimeout(() => { sessionExpired.value = true; socket?.close() }, expiresIn)
  if (intent?.action === 'direct' && intent.userId) await api('/conversations/direct', { method:'POST', body:JSON.stringify({ user_id:intent.userId }) })
  if (intent?.action === 'group' && intent.groupId) await api(`/groups/${intent.groupId}/join`, { method:'POST' })
  await refreshSidebar(); connectSocket()
  const target = intent?.action === 'direct' ? conversations.value.find(item => Number(item.peer_id) === intent.userId) : conversations.value.find(item => Number(item.id) === intent?.groupId)
  if (target) await selectConversation(target)
}
const createDirect = async () => { if (!peerId.value) return; await api('/conversations/direct', { method:'POST', body:JSON.stringify({ user_id:Number(peerId.value) }) }); peerId.value=''; createPanel.value=false; await refreshSidebar() }
const createGroup = async () => { if (!groupName.value.trim()) return; try { const captchaGrant = await getCaptchaGrant('im_create_group'); await api('/conversations/group', { method:'POST', captchaGrant, body:JSON.stringify({ name:groupName.value.trim() }) }); groupName.value=''; createPanel.value=false; await refreshSidebar() } catch (error) { showToast(error.message, 'error') } }
const searchUsers = async () => { const keyword = filter.value.trim(); if (!keyword) { searchResults.value = []; return } try { const captchaGrant = await getCaptchaGrant('im_search'); searchResults.value = await api('/search', { method:'POST', captchaGrant, body:JSON.stringify({ keyword }) }) } catch (error) { showToast(error.message, 'error') } }
const startDirect = async user => { peerId.value = String(user.id); searchResults.value = []; await createDirect() }
const handleRequest = async (request, action) => { await api(`/conversation-requests/${request.conversation_id}`, { method:'POST', body:JSON.stringify({ action }) }); await refreshSidebar() }
const selectConversation = async item => { selected.value = item; loading.value = true; try { messages.value = await api(`/conversations/${item.id}/messages`); await nextTick(); timeline.value?.scrollTo(0, timeline.value.scrollHeight) } finally { loading.value = false } }
const sendMessage = async () => {
  if (!selected.value || !draft.value.trim() || sending.value) return
  const content = draft.value.trim(); draft.value = ''; sending.value = true
  try { const captchaGrant = await getCaptchaGrant('im_message'); await api('/messages', { method: 'POST', captchaGrant, body: JSON.stringify({ conversation_id: selected.value.id, client_message_id: crypto.randomUUID(), content }) }) }
  catch (error) { draft.value = content; showToast(error.message, 'error') } finally { sending.value = false }
}
const sendImage = async event => {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file || !selected.value || sending.value) return
  sending.value = true
  try {
    const data = new FormData(); data.append('image', file)
    const uploadResponse = await fetch('/im/api/images', { method: 'POST', credentials: 'include', body: data })
    const upload = await uploadResponse.json(); if (!uploadResponse.ok) throw new Error(upload.msg || '图片上传失败')
    const captchaGrant = await getCaptchaGrant('im_message')
    await api('/messages', { method: 'POST', captchaGrant, body: JSON.stringify({ conversation_id: selected.value.id, client_message_id: crypto.randomUUID(), type: 'image', image_id: upload.data.id }) })
  } catch (error) { showToast(error.message, 'error') } finally { sending.value = false }
}
const openReport = message => { reportDialog.open = true; reportDialog.message = message; reportDialog.reason = ''; reportDialog.error = '' }
const closeReport = () => { if (!reportDialog.submitting) reportDialog.open = false }
const submitReport = async () => { reportDialog.error = ''; reportDialog.submitting = true; try { await api('/reports', { method:'POST', body:JSON.stringify({ message_id:reportDialog.message.id, reason:reportDialog.reason.trim() }) }); reportDialog.open = false; showToast('举报已提交，管理员会尽快处理') } catch (error) { reportDialog.error = error.message } finally { reportDialog.submitting = false } }
const connectSocket = () => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${protocol}//${location.host}/im/ws`)
  socket.onopen = () => { socketState.value = '实时链路在线' }
  socket.onclose = event => {
    socketState.value = '链路已断开'
    if (event.code === 4001 || Number(me.value?.exp || 0) * 1000 <= Date.now()) {
      sessionExpired.value = true
      return
    }
    if (!sessionExpired.value) setTimeout(connectSocket, 2000)
  }
  socket.onmessage = async event => { const frame = JSON.parse(event.data); if (frame.event === 'message.new' && Number(frame.data.conversation_id) === Number(selected.value?.id) && !messages.value.some(item => String(item.id) === String(frame.data.id))) { messages.value.push(frame.data); await nextTick(); timeline.value?.scrollTo(0, timeline.value.scrollHeight) } }
}
const formatTime = value => value ? new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
const imageData = message => { try { return JSON.parse(message.content) } catch { return { url: '' } } }
onMounted(() => load().catch(error => { initialLoginError.value = error.message; socketState.value = error.message }))
onUnmounted(() => socket?.close())
</script>
<style scoped>
.timeline { padding:24px clamp(16px,2vw,28px); }
.message-image { display:block; max-width:min(420px,60vw); max-height:360px; margin-top:8px; border:1px solid #e2e4e8; border-radius:5px 15px 15px 15px; object-fit:contain; background:#fff; }
.composer footer > div { display:flex; gap:8px; }
.image-button { display:inline-flex; align-items:center; border:1px solid #dfe2e8; border-radius:9px; padding:8px 12px; color:#666b73; background:#fafafa; cursor:pointer; }
.image-button input { display:none; }
.create-panel { display:grid; gap:8px; padding:0 6px 10px; }
.create-panel form { display:flex; gap:6px; }
.create-panel input { min-width:0; flex:1; height:32px; border:1px solid #dfe2e8; border-radius:7px; background:#fafafa; color:#30343a; padding:0 9px; }
.create-panel button,.requests button { border:0; border-radius:7px; background:#ffc43d; color:#111820; font-weight:700; padding:0 9px; cursor:pointer; }
.search button{border:0;background:transparent;color:#b47b00;font-size:11px;cursor:pointer}.search-results{display:grid;gap:4px;margin:0 6px 10px}.search-results>button{display:flex;align-items:center;gap:8px;padding:7px;border:0;border-radius:9px;background:#fff9e8;text-align:left;cursor:pointer}.search-results .avatar{width:28px;height:28px}.search-results b,.search-results small{display:block}.search-results small{color:#979ca5;font-size:10px}
.requests { margin:4px 6px 10px; padding:10px; border:1px solid #f0d27c; border-radius:9px; background:#fff9e6; }
.requests > small { color:#b77a00; }
.requests > div { display:grid; grid-template-columns:1fr auto auto; gap:5px; align-items:center; margin-top:8px; font-size:11px; }
.requests button { height:25px; font-size:10px; }
.requests button.ghost { background:#fff; color:#7d828a; border:1px solid #dfe2e8; }
.report-message { border:0; background:transparent; color:#a0a4ad; padding:0; font-size:11px; cursor:pointer; }.report-message:hover{color:#f56c6c}
.avatar { position:relative; overflow:hidden; }
.avatar img { position:absolute; inset:0; display:block; width:100%; height:100%; object-fit:cover; }
.back-link { margin-left:auto; color:#a86f00; font-size:11px; text-decoration:none; white-space:nowrap; }.back-link:hover,.user-link:hover{color:#d28c00;text-decoration:underline}.user-link{cursor:pointer}
.modal-mask{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(25,29,35,.42);backdrop-filter:blur(3px)}
.report-dialog{width:min(500px,100%);padding:22px;border:1px solid #e3e5e9;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(20,25,32,.22)}
.report-dialog header{display:flex;justify-content:space-between;align-items:flex-start}.report-dialog header small{color:#c88700}.report-dialog h2{margin:5px 0 0}.report-dialog header button{border:0;background:transparent;color:#8c929b;font-size:26px;cursor:pointer}.report-dialog>p{color:#7f858e;font-size:13px;line-height:1.7}
.report-dialog label{display:grid;grid-template-columns:1fr auto;gap:8px;color:#4f555d;font-size:13px}.report-dialog label span{color:#a0a5ad}.report-dialog textarea{grid-column:1/-1;min-height:120px;resize:vertical;padding:12px;border:1px solid #dfe2e7;border-radius:10px;outline:none}.report-dialog textarea:focus{border-color:#fec433;box-shadow:0 0 0 3px #fff5d6}.report-dialog footer{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.report-dialog footer button{height:38px;padding:0 17px;border:0;border-radius:9px;background:#fec433;font-weight:700;cursor:pointer}.report-dialog footer button.ghost{border:1px solid #dfe2e7;background:#fff;color:#666}.report-dialog footer button:disabled{opacity:.5}.dialog-error{margin-top:10px;padding:9px 11px;border-radius:8px;background:#fff1f1;color:#d34b4b;font-size:12px}
.toast{position:fixed;z-index:1100;top:24px;left:50%;transform:translateX(-50%);padding:11px 18px;border:1px solid #dce7d8;border-radius:10px;background:#f2fbef;color:#38823b;box-shadow:0 10px 30px rgba(31,35,41,.16)}.toast.error{border-color:#f3c1c1;background:#fff2f2;color:#c74343}.toast.warning{border-color:#f0d27c;background:#fff9e6;color:#a86f00}
.session-expired{z-index:1200}.reauth-button{display:inline-flex;align-items:center;justify-content:center;height:38px;padding:0 18px;border-radius:9px;background:#fec433;color:#20242a;font-weight:700;text-decoration:none}
.captcha-dialog{width:min(420px,100%)}.captcha-box{min-height:44px;margin-top:16px}
.auth-failure .orb{background:#fff0f0;color:#d84b4b}.auth-failure p{max-width:520px}.auth-failure .reauth-button{margin-top:10px}
</style>

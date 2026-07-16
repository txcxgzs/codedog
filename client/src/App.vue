<template>
  <el-config-provider :locale="zhCn">
  <div class="r-index--root_container" :class="{ 'is-developer-shell': $route.path.startsWith('/developer') }">
    <!-- 顶部导航栏 -->
    <div class="c-navigator--navigator">
      <div class="c-navigator--header-content">
        <!-- Logo -->
        <a href="/" class="c-navigator--logo_wrap">
          <span class="c-navigator--logo_text">编程狗社区</span>
        </a>
        
        <!-- 导航菜单 -->
        <ul class="c-navigator--nav_wrap">
          <li class="c-navigator--item" :class="{ 'c-navigator--selected': $route.path === '/' }">
            <router-link to="/">首页</router-link>
          </li>
          <li class="c-navigator--item" :class="{ 'c-navigator--selected': $route.path.startsWith('/works') || $route.path.startsWith('/work/') }">
            <router-link to="/works">发现</router-link>
          </li>
          <li class="c-navigator--item" :class="{ 'c-navigator--selected': $route.path.startsWith('/community') || $route.path.startsWith('/post/') }">
            <router-link to="/community">社区</router-link>
          </li>
          <li class="c-navigator--item" :class="{ 'c-navigator--selected': $route.path.startsWith('/work_shop') || $route.path.startsWith('/studio/') }">
            <router-link to="/work_shop">工作室</router-link>
          </li>
        </ul>
        
        <!-- 登录后的常用平台入口放在搜索框左侧。 -->
        <div v-if="userStore.isLoggedIn" class="c-navigator--platform_links" aria-label="平台快捷入口">
          <button type="button" :class="{ active: $route.path.startsWith('/developer') }" @click="$router.push('/developer')">
            <span>开发者平台</span>
          </button>
          <button type="button" @click="openIm">
            <span>即时通讯</span>
          </button>
        </div>

        <!-- 搜索框 -->
        <form class="c-navigator--search_wrap" role="search" autocomplete="off" @submit.prevent="handleSearch">
          <el-input
            v-model="searchKeyword"
            class="c-navigator--search_input"
            type="search"
            id="codedog-content-search"
            name="codedog-content-search-query"
            autocomplete="one-time-code"
            inputmode="search"
            aria-label="搜索社区作品和用户"
            role="searchbox"
            placeholder="搜索作品、用户"
            :prefix-icon="Search"
            @keyup.enter="handleSearch"
            clearable
          />
        </form>
        
        <!-- 用户区域 -->
        <div class="c-navigator--user_wrap">
          <template v-if="userStore.isLoggedIn">
            <el-button type="primary" round class="c-navigator--publish_btn" @click="$router.push('/publish')">
              <el-icon class="el-icon--left"><EditPen /></el-icon>
              发布作品
            </el-button>

            <!-- 一键登录（impersonate）后展示恢复管理员身份入口 -->
            <el-button v-if="hasAdminToken" type="warning" plain size="small" @click="restoreAdmin">
              恢复管理员身份
            </el-button>
            
            <!-- 通知图标 -->
            <button
              type="button"
              class="c-navigator--mobile_im"
              aria-label="打开即时通讯"
              title="即时通讯"
              @click="openIm"
            >
              <el-icon :size="20"><ChatDotRound /></el-icon>
            </button>

            <div class="c-navigator--notification" @click="$router.push('/notifications')">
              <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount" class="c-navigator--badge_item">
                <el-icon :size="20" color="#666"><Bell /></el-icon>
              </el-badge>
            </div>
            
            <el-dropdown trigger="click" @command="handleCommand">
              <div class="c-navigator--user_info">
                <el-avatar :size="32" :src="userStore.user?.avatar || defaultAvatar">
                  {{ (userStore.user?.nickname || userStore.user?.username || '狗').charAt(0) }}
                </el-avatar>
                <span class="c-navigator--username">{{ userStore.user?.nickname || userStore.user?.username }}</span>
                <el-icon class="el-icon--right"><CaretBottom /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu class="c-navigator--menu">
                  <el-dropdown-item command="publicProfile"><el-icon><User /></el-icon>我的主页</el-dropdown-item>
                  <el-dropdown-item command="profile"><el-icon><Setting /></el-icon>编辑资料</el-dropdown-item>
                  <el-dropdown-item command="myWorks"><el-icon><Monitor /></el-icon>我的作品</el-dropdown-item>
                  <el-dropdown-item command="notifications"><el-icon><Bell /></el-icon>消息通知</el-dropdown-item>
                  <el-dropdown-item command="im"><el-icon><ChatDotRound /></el-icon>即时通讯</el-dropdown-item>
                  <el-dropdown-item command="favorites"><el-icon><Star /></el-icon>我的收藏</el-dropdown-item>
                  <el-dropdown-item v-if="userStore.isAdmin" command="admin" divided><el-icon><Setting /></el-icon>后台管理</el-dropdown-item>
                  <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <el-button text class="c-navigator--login_btn" @click="$router.push('/login')">登录</el-button>
            <el-button type="primary" round class="c-navigator--register_btn" @click="$router.push('/register')">注册</el-button>
          </template>
        </div>
      </div>
    </div>
    
    <!-- 全局公告顶部通知条 -->
    <div v-if="topBarAnnouncements.length" class="r-ann--top_stack">
      <div
        v-for="item in topBarAnnouncements"
        :key="'bar-' + item.id"
        class="r-ann--top_bar"
        :style="announcementThemeStyle(item)"
      >
        <div class="r-ann--top_bar_inner">
          <strong class="r-ann--top_title">{{ item.title }}</strong>
          <span class="r-ann--top_content">{{ item.content }}</span>
          <button class="r-ann--top_close" type="button" @click="dismissTopBar(item.id)" aria-label="关闭">×</button>
        </div>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="r-index--main_content">
      <router-view v-slot="{ Component }">
        <transition name="fade-transform" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
    <MobileBottomNav v-if="!$route.path.startsWith('/developer') && !$route.path.startsWith('/admin')" />
    
    <!-- 底部 -->
    <div class="c-footer--footer">
      <div class="c-footer--content">
        <div class="c-footer--links">
          <a href="javascript:;">关于我们</a>
          <span class="c-footer--divider">|</span>
          <a href="javascript:;">联系我们</a>
          <span class="c-footer--divider">|</span>
          <a href="javascript:;">服务协议</a>
          <span class="c-footer--divider">|</span>
          <a href="javascript:;">隐私政策</a>
        </div>
        <p class="c-footer--copyright">© 2024 编程狗社区 - 作品分享平台 | 本站作品来源于编程猫平台，仅供学习交流</p>
      </div>
    </div>
    
    <!-- 全局公告弹窗 -->
    <el-dialog
      v-model="popupDialogVisible"
      :title="currentPopupAnnouncement?.title || '公告'"
      width="480px"
      :close-on-click-modal="false"
      @closed="onPopupClosed"
    >
      <div
        v-if="currentPopupAnnouncement"
        class="r-ann--popup_body"
        :style="announcementThemeStyle(currentPopupAnnouncement)"
      >
        <div class="r-ann--popup_content">{{ currentPopupAnnouncement.content }}</div>
      </div>
      <template #footer>
        <el-button type="primary" @click="closeCurrentPopup">我知道了</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="warningDialogVisible"
      title="社区违规警告与保证书"
      width="min(560px, 92vw)"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :before-close="() => {}"
      append-to-body
    >
      <div v-if="pendingWarning" class="r-warning--body">
        <div class="r-warning--notice"><strong>你收到了一次正式违规警告</strong><p>{{ pendingWarning.reason }}</p></div>
        <p class="r-warning--meta">发出时间：{{ new Date(pendingWarning.created_at).toLocaleString() }} · 处理人：{{ pendingWarning.issuer?.nickname || pendingWarning.issuer?.username || '社区管理团队' }}</p>
        <el-input v-model="warningGuarantee" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="请填写不少于 10 个字的保证内容，例如：我已了解社区规范，保证不再发布违规内容……" />
        <el-checkbox v-model="warningAccepted" class="r-warning--check">我已阅读警告，承诺遵守社区规范并不再违规</el-checkbox>
      </div>
      <template #footer><el-button type="primary" :loading="warningSubmitting" :disabled="!warningAccepted || warningGuarantee.trim().length < 10" @click="submitWarningGuarantee">签署保证书并继续使用</el-button></template>
    </el-dialog>

    <HCaptchaDialog ref="hcaptchaDialogRef" />
  </div>
  </el-config-provider>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { imApi } from '@/api/im'
import { useNotificationStore } from '@/stores/notification'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { storeToRefs } from 'pinia'
import HCaptchaDialog from '@/components/HCaptchaDialog.vue'
import MobileBottomNav from '@/components/MobileBottomNav.vue'
import { hcaptchaApi } from '@/api/hcaptcha'
import { publicApi } from '@/api/public'
import { userApi } from '@/api/user'
import { Search, EditPen, Bell, CaretBottom, User, Monitor, Star, Setting, SwitchButton, ChatDotRound } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { unreadCount } = storeToRefs(notificationStore)
const searchKeyword = ref('')
const hcaptchaDialogRef = ref(null)
const hcaptchaVerified = ref(false)
const PRETTY_CURSOR_PREFERENCE = 'codedog_pretty_cursor_choice_v1'

const applyPrettyCursor = enabled => {
  document.documentElement.classList.toggle('codedog-pretty-cursor', enabled)
}

const syncPrettyCursorPreference = event => {
  applyPrettyCursor(!!event.detail?.enabled)
}

const askPrettyCursorPreference = async () => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  const saved = localStorage.getItem(PRETTY_CURSOR_PREFERENCE)
  if (saved) {
    applyPrettyCursor(saved === 'enabled')
    return
  }
  if (warningDialogVisible.value || popupDialogVisible.value) {
    setTimeout(askPrettyCursorPreference, 1000)
    return
  }
  try {
    await ElMessageBox.confirm('要启用编程狗为你准备的精致鼠标样式吗？普通状态使用立体箭头，点击链接和按钮时会变成手型。', '发现好看的鼠标', {
      confirmButtonText: '使用好看的鼠标',
      cancelButtonText: '保持系统鼠标',
      distinguishCancelAndClose: true,
      type: 'info',
      closeOnClickModal: false
    })
    localStorage.setItem(PRETTY_CURSOR_PREFERENCE, 'enabled')
    applyPrettyCursor(true)
    ElMessage.success('好看的鼠标已启用')
  } catch (_) {
    localStorage.setItem(PRETTY_CURSOR_PREFERENCE, 'disabled')
    applyPrettyCursor(false)
  }
}

const announcements = ref([])
const dismissedTopBarIds = ref(loadDismissedIds('ann_topbar_dismissed'))
const dismissedPopupIds = ref(loadDismissedIds('ann_popup_dismissed'))
const popupQueue = ref([])
const popupDialogVisible = ref(false)
const currentPopupAnnouncement = ref(null)
const pendingWarning = ref(null)
const warningDialogVisible = ref(false)
const warningGuarantee = ref('')
const warningAccepted = ref(false)
const warningSubmitting = ref(false)

const fetchPendingWarning = async () => {
  if (!userStore.isLoggedIn) return
  try {
    const res = await userApi.getPendingWarning()
    pendingWarning.value = res.data || null
    warningDialogVisible.value = !!pendingWarning.value
  } catch (_) {}
}

const submitWarningGuarantee = async () => {
  if (!pendingWarning.value) return
  warningSubmitting.value = true
  try {
    const res = await userApi.acknowledgeWarning(pendingWarning.value.id, { accepted: warningAccepted.value, guarantee_text: warningGuarantee.value.trim() })
    if (res.code === 200) {
      ElMessage.success(res.msg || '保证书已签署')
      warningDialogVisible.value = false
      pendingWarning.value = null
      warningGuarantee.value = ''
      warningAccepted.value = false
      await fetchPendingWarning()
    }
  } catch (e) { ElMessage.error(e.response?.data?.msg || '签署失败') }
  finally { warningSubmitting.value = false }
}

// SPA 每次进入路由计一次 PV；服务端自行读取并匿名化 IP，前端不发送 IP。
watch(() => route.fullPath, () => {
  publicApi.recordVisit().catch(() => {})
}, { immediate: true })

// App 通常早于登录页挂载；监听用户 ID 才能在登录完成后及时获取未读数。
// 同时覆盖退出后切换账号，避免沿用上一账号的红点数量。
watch(() => userStore.user?.id, (userId) => {
  if (userId) {
    notificationStore.fetchUnreadCount()
    fetchPendingWarning()
  } else {
    notificationStore.unreadCount = 0
    warningDialogVisible.value = false
    pendingWarning.value = null
  }
}, { immediate: true })

const refreshUnreadWhenVisible = () => {
  if (!document.hidden && userStore.isLoggedIn) notificationStore.fetchUnreadCount()
}

const announcementColorMap = {
  blue: { bg: '#ecf5ff', border: '#409EFF', text: '#1f2d3d' },
  green: { bg: '#f0f9eb', border: '#67C23A', text: '#1f2d3d' },
  orange: { bg: '#fdf6ec', border: '#E6A23C', text: '#1f2d3d' },
  red: { bg: '#fef0f0', border: '#F56C6C', text: '#1f2d3d' },
  purple: { bg: '#f5eef8', border: '#9B59B6', text: '#1f2d3d' },
  yellow: { bg: '#fff9e6', border: '#FEC433', text: '#1f2d3d' }
}

function loadDismissedIds(key) {
  try {
    const raw = localStorage.getItem(key)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.map(String) : []
  } catch (e) {
    return []
  }
}

function saveDismissedIds(key, ids) {
  try { localStorage.setItem(key, JSON.stringify(ids.slice(-50))) } catch (e) {}
}

const announcementThemeStyle = (item) => {
  const theme = announcementColorMap[item?.color] || announcementColorMap.blue
  return {
    background: theme.bg,
    borderColor: theme.border,
    color: theme.text
  }
}

const topBarAnnouncements = computed(() =>
  announcements.value.filter(a => a.show_top_bar !== false && !dismissedTopBarIds.value.includes(String(a.id)))
)

const dismissTopBar = (id) => {
  const sid = String(id)
  if (!dismissedTopBarIds.value.includes(sid)) {
    dismissedTopBarIds.value = [...dismissedTopBarIds.value, sid]
    saveDismissedIds('ann_topbar_dismissed', dismissedTopBarIds.value)
  }
}

const queuePopupQueue = () => {
  popupQueue.value = announcements.value.filter(a => !!a.show_popup && !dismissedPopupIds.value.includes(String(a.id)))
  if (!popupDialogVisible.value) showNextPopup()
}

const showNextPopup = () => {
  if (!popupQueue.value.length) {
    currentPopupAnnouncement.value = null
    popupDialogVisible.value = false
    return
  }
  currentPopupAnnouncement.value = popupQueue.value[0]
  popupDialogVisible.value = true
}

const closeCurrentPopup = () => {
  const current = currentPopupAnnouncement.value
  if (current) {
    const sid = String(current.id)
    if (!dismissedPopupIds.value.includes(sid)) {
      dismissedPopupIds.value = [...dismissedPopupIds.value, sid]
      saveDismissedIds('ann_popup_dismissed', dismissedPopupIds.value)
    }
    popupQueue.value = popupQueue.value.filter(a => String(a.id) !== sid)
  }
  popupDialogVisible.value = false
}

const onPopupClosed = () => {
  // 关闭动画结束后再展示下一条
  setTimeout(() => showNextPopup(), 120)
}

const loadAnnouncements = async () => {
  try {
    const res = await publicApi.getAnnouncements()
    if (res.code === 200) {
      announcements.value = Array.isArray(res.data) ? res.data : []
      queuePopupQueue()
    }
  } catch (e) {}
}


const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

let isCheckingHCaptcha = false
let hcaptchaCheckInterval = null

// 是否处于 impersonate（一键登录）状态：当前用户对象上的 nickname 字段会含"（由 XXX 模拟）"等标记
// 修复: cookie 模式下, 前端无法直接判断是否处于 impersonate 状态. 这里改为简单判断: 是否有 admin_token 标志位
const hasAdminToken = computed(() => !!sessionStorage.getItem('admin_token'))

/**
 * 恢复管理员身份: 调后端 /admin/users/restore-from-impersonate 接口
 * 修复: 之前用 sessionStorage 存 admin_token, cookie 模式下 JS 读不到 cookie, 必须走后端接口
 * 后端从 JWT.impersonatedBy 字段取出原管理员, 重新签发 token 写入 cookie
 */
const restoreAdmin = async () => {
  try {
    const { adminApi } = await import('@/api/admin')
    const res = await adminApi.restoreFromImpersonate()
    if (res.code === 200) {
      // 清理 impersonate 标志, 强制刷新页面让 store 重新加载 admin 用户信息
      sessionStorage.removeItem('admin_token')
      window.location.href = '/admin'
    } else {
      ElMessage.error(res.msg || '恢复失败')
    }
  } catch (e) {
    ElMessage.error('恢复管理员身份失败: ' + (e?.response?.data?.msg || e.message))
  }
}

const checkHCaptcha = async () => {
  if (isCheckingHCaptcha) return
  isCheckingHCaptcha = true
  
  try {
    const res = await hcaptchaApi.getStatus()
    if (res.code === 200 && res.data.required && !res.data.verified) {
      const result = await hcaptchaDialogRef.value.show()
      if (result?.verified) {
        hcaptchaVerified.value = true
      }
    }
  } catch (e) {
    console.error('hCaptcha检查失败:', e)
  } finally {
    isCheckingHCaptcha = false
  }
}

const startHCaptchaCheck = () => {
  if (hcaptchaCheckInterval) {
    clearInterval(hcaptchaCheckInterval)
  }
  hcaptchaCheckInterval = setInterval(() => {
    checkHCaptcha()
  }, 30000)
}

onMounted(async () => {
  setTimeout(askPrettyCursorPreference, 700)
  loadAnnouncements()
  if (userStore.token && !userStore.user) {
    await userStore.fetchCurrentUser()
  }
  if (userStore.isLoggedIn) {
    notificationStore.fetchUnreadCount()
  }
  await checkHCaptcha()
  // 启动定时检查，确保 hCaptcha 验证状态在长期会话中也能及时刷新
  startHCaptchaCheck()

  // 监听全局 hCaptcha 校验事件（由 request 拦截器在 403/HCAPTCHA_REQUIRED 时派发）
  window.addEventListener('hcaptcha-required', checkHCaptcha)
  window.addEventListener('codedog-cursor-preference', syncPrettyCursorPreference)
  window.addEventListener('focus', refreshUnreadWhenVisible)
  document.addEventListener('visibilitychange', refreshUnreadWhenVisible)
})

// 组件卸载时清理事件监听与定时器，避免内存泄漏
onUnmounted(() => {
  window.removeEventListener('hcaptcha-required', checkHCaptcha)
  window.removeEventListener('codedog-cursor-preference', syncPrettyCursorPreference)
  window.removeEventListener('focus', refreshUnreadWhenVisible)
  document.removeEventListener('visibilitychange', refreshUnreadWhenVisible)
  if (hcaptchaCheckInterval) {
    clearInterval(hcaptchaCheckInterval)
    hcaptchaCheckInterval = null
  }
})

const handleSearch = () => {
  if (searchKeyword.value.trim()) {
    router.push({ path: '/works', query: { keyword: searchKeyword.value } })
  }
}

const openIm = async () => {
  try {
    const res = await imApi.createSsoTicket()
    if (res.code === 200 && res.data?.url) window.open(res.data.url, '_blank', 'noopener,noreferrer')
    else ElMessage.warning(res.msg || '即时通讯系统暂不可用')
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || '无法进入即时通讯系统')
  }
}

const handleCommand = (command) => {
  switch (command) {
    case 'publicProfile':
      if (userStore.user?.codemao_user_id) router.push(`/user/${userStore.user.codemao_user_id}`)
      else ElMessage.warning('当前账号暂无可用的公开主页 ID')
      break
    case 'profile': router.push('/profile'); break
    case 'myWorks': router.push('/my-works'); break
    case 'notifications': router.push('/notifications'); break
    case 'im': openIm(); break
    case 'favorites': router.push('/favorites'); break
    case 'admin': router.push('/admin'); break
    case 'logout':
      userStore.logout()
      ElMessage.success('已退出登录')
      router.push('/')
      break
  }
}
</script>

<style lang="scss">
.fade-transform-leave-active,
.fade-transform-enter-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

// 全局变量 - 与编程猫一致
$primary-color: #FEC433;
$primary-hover: #FFD700;
$primary-light: #FFF9E6;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$bg-color: #f5f5f5;
$white: #fff;
$border-color: #eee;
$shadow: 0 2px 12px rgba(0, 0, 0, 0.1);

// 根容器
.r-index--root_container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-color;
}

// 顶栏使用极浅的暖白毛玻璃，与页面两侧淡黄、浅蓝渐变自然衔接。
.c-navigator--navigator {
  background: linear-gradient(90deg, rgba(255, 251, 240, .18), rgba(255, 255, 255, .25) 48%, rgba(240, 248, 255, .18));
  border-bottom: 1px solid rgba(255, 255, 255, .38);
  box-shadow: 0 7px 24px rgba(43, 58, 86, .04), inset 0 1px 0 rgba(255, 255, 255, .5);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
  backdrop-filter: blur(18px) saturate(135%);
  position: sticky;
  top: 0;
  z-index: 1000;
  
  .c-navigator--header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 14px;

    :is(button, a, .el-button) {
      color: #111318;
      font-family: "PingFang SC", "Microsoft YaHei UI", "Noto Sans SC", system-ui, sans-serif;
      font-weight: 800;
    }
  }
}

.c-navigator--logo_wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex-shrink: 0;
  text-decoration: none;
  
  .c-navigator--logo_text {
    font-size: 20px;
    font-weight: bold;
    color: $text-color;
    white-space: nowrap;
  }
}

.c-navigator--nav_wrap {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  
  .c-navigator--item {
    a {
      display: block;
      padding: 8px 13px;
      font-size: 16px;
      color: $text-secondary;
      text-decoration: none;
      border-radius: 20px;
      transition: all 0.2s;
      font-weight: 500;
    }
    
    &:hover a {
      color: $primary-color;
      background: $primary-light;
    }
    
    &.c-navigator--selected a {
      color: $text-color;
      background: $primary-color;
      font-weight: 600;
    }
  }
}

.c-navigator--search_wrap {
  flex: 1 1 280px;
  width: clamp(190px, 22vw, 340px);
  min-width: 190px;
  max-width: 340px;
  
  :deep(.el-input__wrapper) {
    border-radius: 20px;
    background-color: #f5f5f5;
    box-shadow: none;
    padding-left: 12px;
    
    &.is-focus {
      background-color: $white;
      box-shadow: 0 0 0 1px $primary-color inset;
    }
  }
  
  :deep(.el-input__inner) {
    height: 36px;
  }
}

.c-navigator--platform_links {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 34px;
    padding: 0 7px;
    border: 0;
    border-radius: 17px;
    background: transparent;
    color: $text-secondary;
    font: inherit;
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
    transition: color .2s, background .2s;

    &:hover,
    &.active {
      color: $text-color;
      background: $primary-light;
    }
  }
}

.c-navigator--user_wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  
  .c-navigator--notification {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    transition: background 0.2s;
    
    &:hover {
      background: #f5f5f5;
    }
    
    .c-navigator--badge_item {
      display: flex;
      align-items: center;
    }
  }
  
  .c-navigator--login_btn {
    color: $text-secondary;
    font-size: 16px;
    
    &:hover {
      color: $primary-color;
    }
  }
  
  .c-navigator--register_btn {
    padding: 10px 24px;
    font-weight: 600;
    border: none;
    
    &:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
  }
  
  // 独立的液态玻璃发布按钮。边缘负责折射与膨胀，中部保持清晰高透；
  // 样式仅绑定该类，若实机观感不合适可单独回滚，不影响其他按钮。
  .c-navigator--publish_btn.el-button {
    --el-button-bg-color: transparent;
    --el-button-border-color: transparent;
    --el-button-hover-bg-color: transparent;
    --el-button-hover-border-color: transparent;
    position: relative;
    isolation: isolate;
    overflow: hidden;
    min-width: 122px;
    height: 40px;
    padding: 0 20px;
    border: 1px solid rgba(255,255,255,.78) !important;
    border-radius: 999px;
    color: #151515;
    font-family: "PingFang SC", "Microsoft YaHei UI", "Noto Sans SC", system-ui, sans-serif;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: .02em;
    background: linear-gradient(180deg, rgba(255,255,255,.4), rgba(255,214,93,.24) 54%, rgba(255,189,36,.3)) !important;
    box-shadow:
      0 9px 18px rgba(141,102,0,.18),
      0 2px 5px rgba(52,42,10,.1),
      inset 0 1px 1px rgba(255,255,255,.98),
      inset 0 -2px 4px rgba(221,157,0,.13);
    -webkit-backdrop-filter: blur(14px) saturate(165%);
    backdrop-filter: blur(14px) saturate(165%);
    transform: translateZ(0);
    transition: transform .28s cubic-bezier(.2,.8,.2,1), box-shadow .28s ease, background .28s ease, backdrop-filter .28s ease;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      padding: 1.5px;
      border-radius: inherit;
      background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(255,255,255,.18) 34%, rgba(255,203,55,.55) 67%, rgba(255,255,255,.9));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      filter: drop-shadow(0 1px 1px rgba(255,255,255,.7));
    }

    &::after {
      content: '';
      position: absolute;
      z-index: 0;
      top: -90%;
      left: -22%;
      width: 46%;
      height: 270%;
      border-radius: 50%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.72), transparent);
      opacity: .6;
      transform: rotate(18deg);
      transition: left .55s cubic-bezier(.2,.8,.2,1), opacity .3s ease;
    }

    &:hover {
      color: #050505;
      background: linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,211,76,.18) 55%, rgba(255,184,19,.24)) !important;
      box-shadow: 0 12px 24px rgba(141,102,0,.2), 0 3px 7px rgba(52,42,10,.12), inset 0 1px 2px rgba(255,255,255,1), inset 0 -2px 5px rgba(221,157,0,.1);
      -webkit-backdrop-filter: blur(5px) saturate(175%);
      backdrop-filter: blur(5px) saturate(175%);
      transform: translateY(-1px) scale(1.035);
    }

    &:hover::after { left: 80%; opacity: .82; }
    &:active { transform: translateY(1px) scale(.98); box-shadow: 0 4px 10px rgba(141,102,0,.16), inset 0 2px 5px rgba(190,139,13,.15); }
    > span { position:relative; z-index:1; }
  }
  
  .c-navigator--user_info {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 20px;
    transition: background 0.2s;
    position: relative;
    
    &:hover {
      background: #f5f5f5;
    }
    
    .c-navigator--username {
      font-size: 15px;
      color: $text-color;
      font-weight: 500;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.r-index--main_content {
  flex: 1;
  width: 100%;
}

// 底部 - 仿编程猫样式
.c-footer--footer {
  background: $white;
  border-top: 1px solid $border-color;
  padding: 40px 0;
  margin-top: auto;
  
  .c-footer--content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    text-align: center;
  }
  
  .c-footer--links {
    margin-bottom: 20px;
    
    a {
      color: $text-secondary;
      font-size: 14px;
      transition: color 0.2s;
      
      &:hover {
        color: $primary-color;
      }
    }
    
    .c-footer--divider {
      color: $border-color;
      margin: 0 16px;
    }
  }
  
  .c-footer--copyright {
    color: $text-muted;
    font-size: 13px;
  }
}

// 响应式
@media (max-width: 1100px) {
  .c-navigator--platform_links button {
    padding: 0 4px;
    font-size: 12px;
  }
}

.c-navigator--mobile_im {
  display: none;
}

@media (max-width: 768px) {
  .c-navigator--header-content {
    gap: 12px;
    padding: 0 16px;
  }
  
  .c-navigator--nav_wrap {
    display: none;
  }
  
  .c-navigator--search_wrap {
    display: none;
  }

  .c-navigator--platform_links {
    margin-left: auto;
    display: none;
  }
  
  .c-navigator--logo_text {
    display: none;
  }
}

.r-ann--top_stack {
  width: 100%;
}
.r-ann--top_bar {
  border-bottom: 2px solid;
  font-size: 13px;
}
.r-ann--top_bar_inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.r-ann--top_title {
  flex-shrink: 0;
}
.r-ann--top_content {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
}
.r-ann--top_close {
  border: none;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
}
.r-ann--top_close:hover { opacity: 1; }
.r-ann--popup_body {
  border-left: 4px solid;
  border-radius: 8px;
  padding: 14px 16px;
}
.is-developer-shell .c-navigator--navigator,
.is-developer-shell .r-ann--top_stack,
.is-developer-shell .c-footer--footer { display: none !important; }
.is-developer-shell .r-index--main_content { min-height: 100vh; }
.r-ann--popup_content {
  white-space: pre-wrap;
  line-height: 1.7;
  word-break: break-word;
}
.r-warning--notice { padding:16px; border:1px solid #ffd6d6; border-radius:12px; background:#fff4f4; color:#8f2525; }
.r-warning--notice strong { display:block; margin-bottom:8px; font-size:16px; }
.r-warning--notice p { margin:0; line-height:1.7; white-space:pre-wrap; }
.r-warning--meta { margin:10px 2px 16px; color:#8b95a5; font-size:12px; }
.r-warning--check { margin-top:14px; white-space:normal; }

html.codedog-pretty-cursor,
html.codedog-pretty-cursor body,
html.codedog-pretty-cursor .r-index--root_container {
  cursor: url('/cursors/stmc-pointer.cur'), default;
}
html.codedog-pretty-cursor :is(a, button, [role='button'], .el-button, .el-dropdown, .el-menu-item, .el-switch, .el-checkbox, .el-radio, .el-select) {
  cursor: url('/cursors/stmc-mirrored-pointer.cur'), pointer !important;
}
html.codedog-pretty-cursor :is(input, textarea, [contenteditable='true'], .el-input__inner, .el-textarea__inner) {
  cursor: text !important;
}
html.codedog-pretty-cursor :is(button:disabled, [aria-disabled='true'], .is-disabled) {
  cursor: not-allowed !important;
}
</style>

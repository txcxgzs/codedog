<template>
  <el-config-provider :locale="zhCn">
  <div class="r-index--root_container" :class="{ 'is-developer-shell': $route.path.startsWith('/developer') }">
    <!-- 顶部导航栏 -->
    <div class="c-navigator--navigator">
      <div class="c-navigator--header-content">
        <!-- Logo -->
        <a href="/" class="c-navigator--logo_wrap">
          <img src="https://static.codemao.cn/community/shequ_logo.png" alt="编程狗社区" class="c-navigator--logo_img" referrerpolicy="no-referrer">
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
                  <el-dropdown-item command="profile"><el-icon><User /></el-icon>个人中心</el-dropdown-item>
                  <el-dropdown-item command="myWorks"><el-icon><Monitor /></el-icon>我的作品</el-dropdown-item>
                  <el-dropdown-item command="developer">开发者平台</el-dropdown-item>
                  <el-dropdown-item command="notifications"><el-icon><Bell /></el-icon>消息通知</el-dropdown-item>
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

    <HCaptchaDialog ref="hcaptchaDialogRef" />
  </div>
  </el-config-provider>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { storeToRefs } from 'pinia'
import HCaptchaDialog from '@/components/HCaptchaDialog.vue'
import MobileBottomNav from '@/components/MobileBottomNav.vue'
import { hcaptchaApi } from '@/api/hcaptcha'
import { publicApi } from '@/api/public'
import { Search, EditPen, Bell, CaretBottom, User, Monitor, Star, Setting, SwitchButton } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { unreadCount } = storeToRefs(notificationStore)
const searchKeyword = ref('')
const hcaptchaDialogRef = ref(null)
const hcaptchaVerified = ref(false)

const announcements = ref([])
const dismissedTopBarIds = ref(loadDismissedIds('ann_topbar_dismissed'))
const dismissedPopupIds = ref(loadDismissedIds('ann_popup_dismissed'))
const popupQueue = ref([])
const popupDialogVisible = ref(false)
const currentPopupAnnouncement = ref(null)

// SPA 每次进入路由计一次 PV；服务端自行读取并匿名化 IP，前端不发送 IP。
watch(() => route.fullPath, () => {
  publicApi.recordVisit().catch(() => {})
}, { immediate: true })

// App 通常早于登录页挂载；监听用户 ID 才能在登录完成后及时获取未读数。
// 同时覆盖退出后切换账号，避免沿用上一账号的红点数量。
watch(() => userStore.user?.id, (userId) => {
  if (userId) notificationStore.fetchUnreadCount()
  else notificationStore.unreadCount = 0
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
  window.addEventListener('focus', refreshUnreadWhenVisible)
  document.addEventListener('visibilitychange', refreshUnreadWhenVisible)
})

// 组件卸载时清理事件监听与定时器，避免内存泄漏
onUnmounted(() => {
  window.removeEventListener('hcaptcha-required', checkHCaptcha)
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

const handleCommand = (command) => {
  switch (command) {
    case 'profile': router.push('/profile'); break
    case 'myWorks': router.push('/my-works'); break
    case 'developer': router.push('/developer'); break
    case 'notifications': router.push('/notifications'); break
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

// 导航栏 - 仿编程猫样式
.c-navigator--navigator {
  background: $white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
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
    gap: 24px;
  }
}

.c-navigator--logo_wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex-shrink: 0;
  text-decoration: none;
  
  .c-navigator--logo_img {
    height: 38px;
    width: auto;
    flex-shrink: 0;
    display: block;
  }
  
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
      padding: 8px 16px;
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
  flex: 1;
  max-width: 300px;
  
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

.c-navigator--user_wrap {
  display: flex;
  align-items: center;
  gap: 16px;
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
  
  .c-navigator--publish_btn {
    padding: 10px 20px;
    font-weight: 600;
    border: none;
    box-shadow: 0 2px 6px rgba(254, 196, 51, 0.4);
    
    &:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(254, 196, 51, 0.5);
    }
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
.c-navigator--menu .el-dropdown-menu__item:nth-child(3)::before { content:''; display:inline-block; width:16px; height:16px; margin-right:8px; vertical-align:-3px; background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.7'%3E%3Crect x='4' y='3' width='16' height='18' rx='2'/%3E%3Cpath d='M8 7h8M8 11h8M8 15h5'/%3E%3C/svg%3E") center/contain no-repeat; }

.r-ann--popup_content {
  white-space: pre-wrap;
  line-height: 1.7;
  word-break: break-word;
}
</style>

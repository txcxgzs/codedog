<template>
  <el-config-provider :locale="zhCn">
    <div class="app">
      <!-- Navigation -->
      <nav class="nav">
        <div class="nav-inner">
          <!-- Logo -->
          <router-link to="/" class="logo">
            <div class="logo-mark">
              <svg viewBox="0 0 48 48" class="logo-svg">
                <rect x="4" y="4" width="40" height="40" rx="12" fill="#FEC433"/>
                <rect x="12" y="12" width="24" height="24" rx="6" fill="#0A0A0A"/>
                <circle cx="20" cy="24" r="4" fill="#FEC433"/>
                <circle cx="28" cy="24" r="4" fill="#FEC433"/>
              </svg>
            </div>
            <div class="logo-text">
              <span class="logo-name">编程狗</span>
              <span class="logo-sub">社区</span>
            </div>
          </router-link>

          <!-- Nav Links -->
          <div class="nav-links">
            <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">首页</router-link>
            <router-link to="/works" class="nav-link" :class="{ active: $route.path === '/works' }">发现</router-link>
            <router-link to="/community" class="nav-link" :class="{ active: $route.path === '/community' }">社区</router-link>
            <router-link to="/work_shop" class="nav-link" :class="{ active: $route.path === '/work_shop' }">工作室</router-link>
          </div>

          <!-- Search -->
          <div class="search">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索作品..."
              :prefix-icon="SearchIcon"
              @keyup.enter="handleSearch"
              clearable
            />
          </div>

          <!-- User -->
          <div class="user">
            <template v-if="userStore.isLoggedIn">
              <el-button type="primary" @click="$router.push('/publish')">发布作品</el-button>
              <div class="notif" @click="$router.push('/notifications')">
                <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount">
                  <BellIcon />
                </el-badge>
              </div>
              <el-dropdown trigger="click" @command="handleCommand">
                <div class="user-info">
                  <el-avatar :size="38" :src="userStore.user?.avatar || defaultAvatar" />
                  <span class="user-name">{{ userStore.user?.nickname || userStore.user?.username }}</span>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                    <el-dropdown-item command="myWorks">我的作品</el-dropdown-item>
                    <el-dropdown-item command="favorites">我的收藏</el-dropdown-item>
                    <el-dropdown-item v-if="userStore.isAdmin" command="admin" divided>后台管理</el-dropdown-item>
                    <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
            <template v-else>
              <el-button text @click="$router.push('/login')">登录</el-button>
              <el-button type="primary" @click="$router.push('/register')">注册</el-button>
            </template>
          </div>
        </div>
      </nav>

      <!-- Main -->
      <main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Footer -->
      <footer class="footer">
        <div class="footer-inner">
          <div class="footer-brand">
            <span class="brand-name">编程狗社区</span>
            <span class="brand-copy">© 2024</span>
          </div>
          <div class="footer-links">
            <a href="javascript:;">关于我们</a>
            <a href="javascript:;">联系我们</a>
            <a href="javascript:;">服务协议</a>
            <a href="javascript:;">隐私政策</a>
          </div>
        </div>
      </footer>

      <HCaptchaDialog ref="hcaptchaDialogRef" />
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, onMounted, h } from 'vue'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'
import { useRouter } from 'vue-router'
import { ElMessage, ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { storeToRefs } from 'pinia'
import HCaptchaDialog from '@/components/HCaptchaDialog.vue'
import { hcaptchaApi } from '@/api/hcaptcha'

const router = useRouter()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { unreadCount } = storeToRefs(notificationStore)
const searchKeyword = ref('')
const hcaptchaDialogRef = ref(null)

const SearchIcon = h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', class: 'icon' }, [
  h('circle', { cx: '11', cy: '11', r: '8' }),
  h('path', { d: 'm21 21-4.35-4.35' })
])

const BellIcon = h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', class: 'icon' }, [
  h('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
  h('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
])

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzBhMGEwYSI+8J+SgTwvdGV4dD48L3N2Zz4='

onMounted(async () => {
  if (userStore.token && !userStore.user) {
    await userStore.fetchCurrentUser()
  }
  if (userStore.isLoggedIn) {
    notificationStore.fetchUnreadCount()
  }
  
  try {
    const res = await hcaptchaApi.getStatus()
    if (res.code === 200 && res.data.required && !res.data.verified) {
      await hcaptchaDialogRef.value?.show()
    }
  } catch (e) {}
})

const handleSearch = () => {
  if (searchKeyword.value.trim()) {
    router.push({ path: '/works', query: { keyword: searchKeyword.value } })
  }
}

const handleCommand = (command) => {
  const actions = {
    profile: () => router.push('/profile'),
    myWorks: () => router.push('/my-works'),
    notifications: () => router.push('/notifications'),
    favorites: () => router.push('/favorites'),
    admin: () => router.push('/admin'),
    logout: () => {
      userStore.logout()
      ElMessage.success('已退出登录')
      router.push('/')
    }
  }
  actions[command]?.()
}
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);

  .nav-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 40px;
    height: 72px;
    display: flex;
    align-items: center;
    gap: 48px;
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
  flex-shrink: 0;

  .logo-mark {
    width: 48px;
    height: 48px;

    .logo-svg {
      width: 100%;
      height: 100%;
    }
  }

  .logo-text {
    display: flex;
    flex-direction: column;

    .logo-name {
      font-family: var(--font-display);
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--text);
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .logo-sub {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
  }
}

.nav-links {
  display: flex;
  gap: 8px;

  .nav-link {
    padding: 10px 20px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius);
    transition: all 0.2s ease;

    &:hover {
      color: var(--text);
      background: var(--primary-light);
    }

    &.active {
      color: var(--text);
      font-weight: 600;
      background: var(--primary);
    }
  }
}

.search {
  flex: 1;
  max-width: 360px;

  :deep(.el-input__wrapper) {
    border-radius: 9999px;
    background: var(--bg);
    border: none;
    padding: 4px 20px;
    box-shadow: none;

    &:hover,
    &.is-focus {
      background: var(--surface);
      box-shadow: 0 0 0 2px var(--primary);
    }
  }

  :deep(.el-input__inner) {
    font-weight: 500;

    &::placeholder {
      color: var(--text-muted);
    }
  }

  :deep(.icon) {
    width: 18px;
    height: 18px;
    color: var(--text-muted);
  }
}

.user {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;

  .notif {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--text-secondary);

    &:hover {
      background: var(--primary-light);
      color: var(--text);
    }

    :deep(.icon) {
      width: 22px;
      height: 22px;
    }
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 14px 6px 6px;
    border-radius: 9999px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: var(--primary-light);
    }

    .user-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.main {
  flex: 1;
}

.footer {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 40px 0;

  .footer-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 16px;

    .brand-name {
      font-family: var(--font-display);
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text);
    }

    .brand-copy {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
  }

  .footer-links {
    display: flex;
    gap: 32px;

    a {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.2s ease;

      &:hover {
        color: var(--primary);
      }
    }
  }
}

@media (max-width: 1024px) {
  .nav-links {
    display: none;
  }
}

@media (max-width: 768px) {
  .nav-inner {
    padding: 0 20px;
    gap: 20px;
  }

  .logo-text {
    display: none;
  }

  .search {
    display: none;
  }

  .footer-inner {
    flex-direction: column;
    gap: 24px;
    text-align: center;
  }

  .footer-links {
    gap: 20px;
  }
}
</style>

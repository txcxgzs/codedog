<template>
  <el-config-provider :locale="zhCn">
    <div class="app">
      <!-- Navigation - Bold & Minimal -->
      <header class="nav">
        <div class="nav-inner">
          <!-- Logo - Geometric Brutalist -->
          <router-link to="/" class="logo">
            <div class="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="8" fill="#FEC433"/>
                <rect x="8" y="8" width="24" height="24" rx="4" fill="#0F0F0F"/>
                <circle cx="15" cy="20" r="3" fill="#FEC433"/>
                <circle cx="25" cy="20" r="3" fill="#FEC433"/>
              </svg>
            </div>
            <div class="logo-text">
              <span class="logo-main">编程狗</span>
              <span class="logo-sub">社区</span>
            </div>
          </router-link>

          <!-- Nav Links -->
          <div class="nav-links">
            <router-link to="/" class="link" :class="{ active: $route.path === '/' }">首页</router-link>
            <router-link to="/works" class="link" :class="{ active: $route.path === '/works' }">发现</router-link>
            <router-link to="/community" class="link" :class="{ active: $route.path === '/community' }">社区</router-link>
            <router-link to="/work_shop" class="link" :class="{ active: $route.path === '/work_shop' }">工作室</router-link>
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
              <el-button type="primary" @click="$router.push('/publish')">发布</el-button>
              <div class="notif" @click="$router.push('/notifications')">
                <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount">
                  <BellIcon />
                </el-badge>
              </div>
              <el-dropdown trigger="click" @command="handleCommand">
                <div class="user-card">
                  <el-avatar :size="36" :src="userStore.user?.avatar || defaultAvatar" />
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
      </header>

      <!-- Main Content -->
      <main class="main">
        <router-view v-slot="{ Component }">
          <transition name="slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Footer -->
      <footer class="footer">
        <div class="footer-inner">
          <div class="footer-left">
            <span class="footer-brand">编程狗社区</span>
            <span class="footer-divider"></span>
            <span class="footer-copy">© 2024</span>
          </div>
          <div class="footer-right">
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

const SearchIcon = h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('circle', { cx: '11', cy: '11', r: '8' }),
  h('path', { d: 'm21 21-4.35-4.35' })
])

const BellIcon = h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
  h('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
])

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzBmMGYwZiI+8J+SgTwvdGV4dD48L3N2Zz4='

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
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

// Navigation
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(247, 245, 242, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);

  .nav-inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 48px;
    height: 72px;
    display: flex;
    align-items: center;
    gap: 56px;
  }
}

// Logo
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  flex-shrink: 0;

  .logo-icon {
    width: 40px;
    height: 40px;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  .logo-text {
    display: flex;
    flex-direction: column;

    .logo-main {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text);
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .logo-sub {
      font-size: 0.625rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-top: 2px;
    }
  }
}

// Nav Links
.nav-links {
  display: flex;
  gap: 4px;

  .link {
    padding: 10px 18px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius);
    transition: all 0.15s ease;

    &:hover {
      color: var(--text);
      background: rgba(254, 196, 51, 0.15);
    }

    &.active {
      color: var(--text);
      font-weight: 600;
      background: var(--primary);
    }
  }
}

// Search
.search {
  flex: 1;
  max-width: 320px;

  :deep(.el-input__wrapper) {
    border-radius: 9999px;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 4px 16px;

    &:hover {
      border-color: var(--primary);
    }

    &.is-focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(254, 196, 51, 0.2);
    }
  }

  :deep(.el-input__inner) {
    font-weight: 500;
  }
}

// User
.user {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  .notif {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    color: var(--text-secondary);

    &:hover {
      background: var(--primary-light);
      color: var(--text);
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .user-card {
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.15s ease;

    &:hover {
      opacity: 0.8;
    }
  }
}

// Main
.main {
  flex: 1;
}

// Footer
.footer {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 48px 0;
  margin-top: 80px;

  .footer-inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 48px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .footer-brand {
      font-family: var(--font-display);
      font-size: 1.125rem;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.02em;
    }

    .footer-divider {
      width: 1px;
      height: 16px;
      background: var(--border);
    }

    .footer-copy {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
  }

  .footer-right {
    display: flex;
    gap: 32px;

    a {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.15s ease;

      &:hover {
        color: var(--primary-dark);
      }
    }
  }
}

// Responsive
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

  .footer-right {
    gap: 20px;
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>

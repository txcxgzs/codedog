<template>
  <el-config-provider :locale="zhCn">
    <div class="app">
      <!-- Navigation -->
      <header class="header">
        <div class="header-inner">
          <!-- Logo -->
          <router-link to="/" class="logo">
            <div class="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="6" fill="#FEC433"/>
                <rect x="8" y="8" width="24" height="24" rx="3" fill="#1D2129"/>
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
          <nav class="nav-links">
            <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">首页</router-link>
            <router-link to="/works" class="nav-link" :class="{ active: $route.path === '/works' }">发现</router-link>
            <router-link to="/community" class="nav-link" :class="{ active: $route.path === '/community' }">社区</router-link>
            <router-link to="/work_shop" class="nav-link" :class="{ active: $route.path === '/work_shop' }">工作室</router-link>
          </nav>

          <!-- Search -->
          <div class="search">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索作品、帖子..."
              :prefix-icon="SearchIcon"
              @keyup.enter="handleSearch"
              clearable
            />
          </div>

          <!-- User -->
          <div class="user-actions">
            <template v-if="userStore.isLoggedIn">
              <el-button type="primary" @click="$router.push('/publish')">发布作品</el-button>
              <div class="notif" @click="$router.push('/notifications')">
                <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount">
                  <BellIcon />
                </el-badge>
              </div>
              <el-dropdown trigger="click" @command="handleCommand">
                <div class="user-avatar">
                  <el-avatar :size="32" :src="userStore.user?.avatar || defaultAvatar" />
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
          <div class="footer-left">
            <span class="footer-logo">编程狗社区</span>
            <span class="footer-copy">© 2024</span>
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

const SearchIcon = h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('circle', { cx: '11', cy: '11', r: '8' }),
  h('path', { d: 'm21 21-4.35-4.35' })
])

const BellIcon = h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
  h('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
])

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzFEMjEyOSI+8J+SgTwvdGV4dD48L3N2Zz4='

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
  transition: all 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
}

.fade-leave-to {
  opacity: 0;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--surface);
  border-bottom: 1px solid var(--border);

  .header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 40px;
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;

  .logo-icon {
    width: 36px;
    height: 36px;
  }

  .logo-text {
    display: flex;
    flex-direction: column;

    .logo-main {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text);
      line-height: 1.1;
    }

    .logo-sub {
      font-size: 0.6875rem;
      color: var(--text-muted);
      font-weight: 500;
    }
  }
}

.nav-links {
  display: flex;
  gap: 4px;

  .nav-link {
    padding: 8px 16px;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius);
    transition: all 0.15s ease;
    font-weight: 500;

    &:hover {
      color: var(--text);
      background: var(--border-light);
    }

    &.active {
      color: var(--text);
      background: var(--primary);
      font-weight: 600;
    }
  }
}

.search {
  flex: 1;
  max-width: 360px;

  :deep(.el-input__wrapper) {
    background: var(--bg);
    border: 1px solid var(--border-light);
    box-shadow: none;

    &:hover,
    &.is-focus {
      border-color: var(--primary);
    }
  }
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  .notif {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    color: var(--text-secondary);

    &:hover {
      background: var(--border-light);
      color: var(--text);
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }

  .user-avatar {
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.15s ease;

    &:hover {
      opacity: 0.85;
    }
  }
}

.main {
  flex: 1;
}

.footer {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 32px 0;
  margin-top: 48px;

  .footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .footer-logo {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
    }

    .footer-copy {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
  }

  .footer-links {
    display: flex;
    gap: 24px;

    a {
      font-size: 0.875rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.15s ease;

      &:hover {
        color: var(--primary-dark);
      }
    }
  }
}

@media (max-width: 960px) {
  .nav-links {
    display: none;
  }
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 16px;
    gap: 16px;
  }

  .logo-text {
    display: none;
  }

  .search {
    display: none;
  }

  .footer-inner {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .footer-links {
    gap: 16px;
  }
}
</style>

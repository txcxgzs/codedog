<template>
  <el-config-provider :locale="zhCn">
    <div class="app">
      <!-- Header -->
      <header class="header">
        <div class="header-inner">
          <!-- Logo -->
          <router-link to="/" class="logo">
            <div class="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="6" fill="#FEC433"/>
                <rect x="8" y="8" width="24" height="24" rx="4" fill="#17181A"/>
                <circle cx="16" cy="20" r="3" fill="#FEC433"/>
                <circle cx="24" cy="20" r="3" fill="#FEC433"/>
              </svg>
            </div>
            <span class="logo-text">编程狗</span>
          </router-link>

          <!-- Nav -->
          <nav class="nav">
            <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
              首页
            </router-link>
            <router-link to="/works" class="nav-item" :class="{ active: $route.path === '/works' }">
              发现
            </router-link>
            <router-link to="/community" class="nav-item" :class="{ active: $route.path === '/community' }">
              社区
            </router-link>
            <router-link to="/work_shop" class="nav-item" :class="{ active: $route.path === '/work_shop' }">
              工作室
            </router-link>
          </nav>

          <!-- Search -->
          <div class="search-wrap">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索作品、帖子..."
              :prefix-icon="SearchIcon"
              @keyup.enter="handleSearch"
              clearable
            />
          </div>

          <!-- User -->
          <div class="user-area">
            <template v-if="userStore.isLoggedIn">
              <el-button type="primary" size="small" @click="$router.push('/publish')">
                发布
              </el-button>
              <div class="notif-btn" @click="$router.push('/notifications')">
                <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount">
                  <BellIcon />
                </el-badge>
              </div>
              <el-dropdown trigger="click" @command="handleCommand">
                <el-avatar :size="32" :src="userStore.user?.avatar || defaultAvatar" class="avatar" />
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
              <el-button text size="small" @click="$router.push('/login')">登录</el-button>
              <el-button type="primary" size="small" @click="$router.push('/register')">注册</el-button>
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
          <div class="footer-brand">
            <span class="brand-name">编程狗社区</span>
            <span class="brand-sep">·</span>
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

const SearchIcon = h('svg', { 
  viewBox: '0 0 24 24', 
  fill: 'none', 
  stroke: 'currentColor', 
  'stroke-width': '2',
  class: 'icon'
}, [
  h('circle', { cx: '11', cy: '11', r: '8' }),
  h('path', { d: 'm21 21-4.35-4.35' })
])

const BellIcon = h('svg', { 
  viewBox: '0 0 24 24', 
  fill: 'none', 
  stroke: 'currentColor', 
  'stroke-width': '2',
  class: 'icon'
}, [
  h('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
  h('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
])

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzE3MTgxQSI+8J+SgTwvdGV4dD48L3N2Zz4='

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
  transition: opacity 0.2s ease;
}

.fade-enter-from,
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
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);

  .header-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 32px;
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;

  .logo-icon {
    width: 32px;
    height: 32px;
  }

  .logo-text {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--text);
  }
}

.nav {
  display: flex;
  gap: 4px;

  .nav-item {
    padding: 6px 14px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius);
    transition: all 0.15s ease;

    &:hover {
      color: var(--text);
      background: rgba(254, 196, 51, 0.12);
    }

    &.active {
      color: var(--text);
      background: var(--primary);
      font-weight: 600;
    }
  }
}

.search-wrap {
  flex: 1;
  max-width: 320px;

  :deep(.el-input__wrapper) {
    background: var(--bg);
    border: 1px solid var(--border);
    box-shadow: none;
    padding: 4px 12px;

    &:hover {
      border-color: var(--border-hover);
    }

    &.is-focus {
      border-color: var(--primary);
      background: var(--surface);
    }
  }

  :deep(.icon) {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
  }
}

.user-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  .notif-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    color: var(--text-secondary);

    &:hover {
      background: rgba(254, 196, 51, 0.12);
      color: var(--text);
    }

    :deep(.icon) {
      width: 18px;
      height: 18px;
    }
  }

  .avatar {
    cursor: pointer;
    transition: all 0.15s ease;
    border: 2px solid transparent;

    &:hover {
      border-color: var(--primary);
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
  margin-top: 64px;

  .footer-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;

    .brand-name {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text);
    }

    .brand-sep {
      color: var(--text-muted);
    }

    .brand-copy {
      font-size: 0.875rem;
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
  .nav {
    display: none;
  }
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 16px;
    gap: 16px;
  }

  .search-wrap {
    display: none;
  }

  .footer-inner {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }

  .footer-links {
    gap: 20px;
  }
}
</style>

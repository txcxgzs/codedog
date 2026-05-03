<template>
  <el-config-provider :locale="zhCn">
    <div class="app-root">
      <!-- 顶部导航栏 -->
      <header class="navbar">
        <div class="navbar-inner">
          <!-- Logo - 艺术化设计 -->
          <router-link to="/" class="logo">
            <div class="logo-mark">
              <svg viewBox="0 0 44 44" class="logo-svg">
                <rect x="4" y="4" width="36" height="36" rx="10" fill="#FEC433"/>
                <rect x="10" y="10" width="24" height="24" rx="6" fill="#0f0f0f"/>
                <circle cx="18" cy="22" r="4" fill="#FEC433"/>
              </svg>
            </div>
            <div class="logo-text">
              <span class="logo-title">编程狗</span>
              <span class="logo-tagline">社区</span>
            </div>
          </router-link>
          
          <!-- 导航 -->
          <nav class="nav">
            <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
              首页
            </router-link>
            <router-link to="/works" class="nav-link" :class="{ active: $route.path === '/works' }">
              发现
            </router-link>
            <router-link to="/community" class="nav-link" :class="{ active: $route.path === '/community' }">
              社区
            </router-link>
            <router-link to="/work_shop" class="nav-link" :class="{ active: $route.path === '/work_shop' }">
              工作室
            </router-link>
          </nav>
          
          <!-- 搜索 -->
          <div class="search">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索作品..."
              :prefix-icon="Search"
              @keyup.enter="handleSearch"
              clearable
            />
          </div>
          
          <!-- 用户 -->
          <div class="user-area">
            <template v-if="userStore.isLoggedIn">
              <el-button type="primary" round @click="$router.push('/publish')">
                发布作品
              </el-button>
              
              <div class="notification" @click="$router.push('/notifications')">
                <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount">
                  <Bell />
                </el-badge>
              </div>
              
              <el-dropdown trigger="click" @command="handleCommand">
                <div class="user">
                  <el-avatar :size="36" :src="userStore.user?.avatar || defaultAvatar" />
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
              <el-button type="primary" round @click="$router.push('/register')">注册</el-button>
            </template>
          </div>
        </div>
      </header>
      
      <!-- 内容 -->
      <main class="main">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
      
      <!-- 底部 -->
      <footer class="footer">
        <div class="footer-inner">
          <div class="footer-brand">
            <span class="footer-logo">编程狗</span>
            <span class="footer-divider"></span>
            <span class="footer-copy">© 2024 编程狗社区</span>
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
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'
import { useRouter } from 'vue-router'
import { ElMessage, ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { storeToRefs } from 'pinia'
import HCaptchaDialog from '@/components/HCaptchaDialog.vue'
import { hcaptchaApi } from '@/api/hcaptcha'
import { Search, Bell } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { unreadCount } = storeToRefs(notificationStore)
const searchKeyword = ref('')
const hcaptchaDialogRef = ref(null)

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzBmMGYwZiI+8J+RqjwvdGV4dD48L3N2Zz4='

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
// 页面过渡
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

// 导航栏 - 大胆设计
.navbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);
  
  .navbar-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 32px;
    height: 72px;
    display: flex;
    align-items: center;
    gap: 48px;
  }
}

// Logo - 艺术化SVG设计
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  flex-shrink: 0;
  
  .logo-mark {
    width: 44px;
    height: 44px;
    
    .logo-svg {
      width: 100%;
      height: 100%;
    }
  }
  
  .logo-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    
    .logo-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-color);
      letter-spacing: -0.02em;
      line-height: 1;
    }
    
    .logo-tagline {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
  }
}

// 导航
.nav {
  display: flex;
  gap: 4px;
  
  .nav-link {
    padding: 8px 20px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius);
    transition: all 0.2s ease;
    
    &:hover {
      color: var(--text-color);
      background: var(--primary-bg);
    }
    
    &.active {
      color: var(--text-color);
      font-weight: 600;
      background: var(--primary-color);
    }
  }
}

// 搜索
.search {
  flex: 1;
  max-width: 400px;
  
  :deep(.el-input__wrapper) {
    border-radius: 9999px;
    background: var(--bg-color);
    border: none;
    padding: 4px 20px;
    box-shadow: none;
    transition: all 0.2s ease;
    
    &:hover,
    &.is-focus {
      background: var(--white);
      box-shadow: 0 0 0 2px var(--primary-color);
    }
  }
  
  :deep(.el-input__inner) {
    font-weight: 500;
    &::placeholder {
      color: var(--text-muted);
    }
  }
}

// 用户区域
.user-area {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  
  .notification {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--text-secondary);
    
    &:hover {
      background: var(--primary-bg);
      color: var(--text-color);
    }
  }
  
  .user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 16px 4px 4px;
    border-radius: 9999px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--primary-bg);
    }
    
    .user-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.main {
  flex: 1;
  width: 100%;
}

// 底部
.footer {
  background: var(--white);
  border-top: 1px solid var(--border-color);
  padding: 48px 0;
  margin-top: auto;
  
  .footer-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .footer-brand {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .footer-logo {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-color);
    }
    
    .footer-divider {
      width: 1px;
      height: 16px;
      background: var(--border-color);
    }
    
    .footer-copy {
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
        color: var(--primary-color);
      }
    }
  }
}

// 响应式
@media (max-width: 1024px) {
  .nav {
    display: none;
  }
}

@media (max-width: 768px) {
  .navbar-inner {
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

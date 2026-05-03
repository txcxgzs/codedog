<template>
  <el-config-provider :locale="zhCn">
    <div class="app-root">
      <!-- 导航栏 - 大胆的艺术化设计 -->
      <header class="navbar">
        <div class="navbar-inner">
          <!-- Logo - 几何图形设计 -->
          <router-link to="/" class="logo">
            <div class="logo-mark">
              <div class="logo-shape"></div>
            </div>
            <div class="logo-text">
              <span class="logo-title">编程狗</span>
              <span class="logo-subtitle">社区</span>
            </div>
          </router-link>
          
          <!-- 导航 - 极简设计 -->
          <nav class="nav">
            <router-link 
              v-for="item in navItems" 
              :key="item.path"
              :to="item.path" 
              class="nav-link"
              :class="{ active: $route.path === item.path }"
            >
              {{ item.label }}
            </router-link>
          </nav>
          
          <!-- 搜索框 -->
          <div class="search">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索作品..."
              :prefix-icon="Search"
              @keyup.enter="handleSearch"
              clearable
              size="default"
            />
          </div>
          
          <!-- 用户区域 -->
          <div class="user-area">
            <template v-if="userStore.isLoggedIn">
              <el-button type="primary" round class="btn-publish" @click="$router.push('/publish')">
                发布
              </el-button>
              
              <div class="notification" @click="$router.push('/notifications')">
                <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount">
                  <el-icon :size="20"><Bell /></el-icon>
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
              <el-button text class="btn-login" @click="$router.push('/login')">登录</el-button>
              <el-button type="primary" round class="btn-register" @click="$router.push('/register')">
                注册
              </el-button>
            </template>
          </div>
        </div>
      </header>
      
      <!-- 主内容 -->
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
          <div class="footer-links">
            <a href="javascript:;">关于我们</a>
            <a href="javascript:;">联系我们</a>
            <a href="javascript:;">服务协议</a>
            <a href="javascript:;">隐私政策</a>
          </div>
          <p class="footer-copy">© 2024 编程狗社区</p>
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

const navItems = [
  { path: '/', label: '首页' },
  { path: '/works', label: '发现' },
  { path: '/community', label: '社区' },
  { path: '/work_shop', label: '工作室' }
]

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
// 页面过渡动画
.page-enter-active,
.page-leave-active {
  transition: all 0.3s var(--ease-out);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

// 导航栏 - 大胆的艺术化设计
.navbar {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1000;
  
  .navbar-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 var(--space-6);
    height: 72px;
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }
}

// Logo - 几何图形设计
.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  flex-shrink: 0;
  
  .logo-mark {
    width: 44px;
    height: 44px;
    position: relative;
    
    .logo-shape {
      width: 100%;
      height: 100%;
      background: var(--primary-color);
      border-radius: var(--radius-md);
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 8px;
        left: 8px;
        right: 8px;
        bottom: 8px;
        background: var(--text-color);
        border-radius: var(--radius-sm);
      }
      
      &::after {
        content: '';
        position: absolute;
        top: 14px;
        left: 14px;
        width: 16px;
        height: 16px;
        background: var(--primary-color);
        border-radius: 50%;
      }
    }
  }
  
  .logo-text {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
    
    .logo-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-color);
      letter-spacing: -0.02em;
    }
    
    .logo-subtitle {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
  }
  
  &:hover .logo-shape {
    animation: logo-pulse 0.6s var(--ease-out);
  }
}

@keyframes logo-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

// 导航 - 极简设计
.nav {
  display: flex;
  gap: var(--space-1);
  
  .nav-link {
    padding: var(--space-2) var(--space-4);
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius);
    transition: all var(--duration-fast) var(--ease-out);
    position: relative;
    
    &:hover {
      color: var(--text-color);
      background: var(--primary-bg);
    }
    
    &.active {
      color: var(--text-color);
      font-weight: 600;
      
      &::after {
        content: '';
        position: absolute;
        bottom: 4px;
        left: 50%;
        transform: translateX(-50%);
        width: 20px;
        height: 3px;
        background: var(--primary-color);
        border-radius: 2px;
      }
    }
  }
}

// 搜索框
.search {
  flex: 1;
  max-width: 400px;
  
  :deep(.el-input__wrapper) {
    border-radius: var(--radius-full);
    background: var(--border-light);
    border: none;
    padding: 0 var(--space-4);
    box-shadow: none;
    transition: all var(--duration) var(--ease-out);
    
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
  gap: var(--space-4);
  flex-shrink: 0;
  
  .btn-publish {
    padding: var(--space-2) var(--space-5);
    font-weight: 700;
    font-size: 0.875rem;
  }
  
  .notification {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    color: var(--text-secondary);
    
    &:hover {
      background: var(--primary-bg);
      color: var(--text-color);
    }
  }
  
  .btn-login {
    font-weight: 600;
    color: var(--text-secondary);
    
    &:hover {
      color: var(--primary-color);
    }
  }
  
  .btn-register {
    padding: var(--space-2) var(--space-5);
    font-weight: 700;
    font-size: 0.875rem;
  }
  
  .user {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1);
    padding-right: var(--space-3);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    
    &:hover {
      background: var(--primary-bg);
    }
    
    .user-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
      max-width: 100px;
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

// 底部 - 极简设计
.footer {
  background: var(--white);
  border-top: 1px solid var(--border-color);
  padding: var(--space-8) 0;
  
  .footer-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 var(--space-6);
    text-align: center;
  }
  
  .footer-links {
    display: flex;
    justify-content: center;
    gap: var(--space-6);
    margin-bottom: var(--space-4);
    
    a {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      transition: color var(--duration-fast) var(--ease-out);
      
      &:hover {
        color: var(--primary-color);
      }
    }
  }
  
  .footer-copy {
    font-size: 0.8125rem;
    color: var(--text-muted);
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
    padding: 0 var(--space-4);
    gap: var(--space-4);
  }
  
  .search {
    display: none;
  }
  
  .logo-text {
    display: none;
  }
  
  .user-area {
    gap: var(--space-2);
    
    .btn-publish {
      padding: var(--space-2) var(--space-3);
    }
  }
}
</style>

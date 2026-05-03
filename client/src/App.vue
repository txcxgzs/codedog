<template>
  <el-config-provider :locale="zhCn">
    <div class="app-root">
      <!-- 顶部导航栏 - 现代化设计 -->
      <header class="navbar">
        <div class="navbar-container">
          <!-- Logo -->
          <router-link to="/" class="logo-wrap">
            <div class="logo-icon"></div>
            <span class="logo-text">编程狗社区</span>
          </router-link>
          
          <!-- 导航菜单 -->
          <nav class="nav-menu">
            <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
              <span class="nav-icon">🏠</span>
              首页
            </router-link>
            <router-link to="/works" class="nav-item" :class="{ active: $route.path === '/works' }">
              <span class="nav-icon">🎮</span>
              发现
            </router-link>
            <router-link to="/community" class="nav-item" :class="{ active: $route.path === '/community' }">
              <span class="nav-icon">💬</span>
              社区
            </router-link>
            <router-link to="/work_shop" class="nav-item" :class="{ active: $route.path === '/work_shop' }">
              <span class="nav-icon">🏢</span>
              工作室
            </router-link>
          </nav>
          
          <!-- 搜索框 -->
          <div class="search-wrap">
            <el-input
              v-model="searchKeyword"
              class="search-input"
              placeholder="搜索作品、用户..."
              :prefix-icon="Search"
              @keyup.enter="handleSearch"
              clearable
              size="default"
            />
          </div>
          
          <!-- 用户区域 -->
          <div class="user-wrap">
            <template v-if="userStore.isLoggedIn">
              <el-button type="primary" round class="publish-btn" @click="$router.push('/publish')">
                <el-icon class="el-icon--left"><EditPen /></el-icon>
                发布作品
              </el-button>
              
              <!-- 通知图标 -->
              <div class="notification-btn" @click="$router.push('/notifications')">
                <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount" class="notification-badge">
                  <el-icon :size="20"><Bell /></el-icon>
                </el-badge>
              </div>
              
              <el-dropdown trigger="click" @command="handleCommand">
                <div class="user-info">
                  <el-avatar :size="36" :src="userStore.user?.avatar || defaultAvatar" class="user-avatar" />
                  <div class="user-meta">
                    <span class="username">{{ userStore.user?.nickname || userStore.user?.username }}</span>
                    <span class="user-level">Lv.{{ userStore.user?.level || 1 }}</span>
                  </div>
                  <el-icon class="caret-icon"><CaretBottom /></el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="profile">
                      <el-icon><User /></el-icon>
                      个人中心
                    </el-dropdown-item>
                    <el-dropdown-item command="myWorks">
                      <el-icon><Monitor /></el-icon>
                      我的作品
                    </el-dropdown-item>
                    <el-dropdown-item command="notifications">
                      <el-icon><Bell /></el-icon>
                      消息通知
                    </el-dropdown-item>
                    <el-dropdown-item command="favorites">
                      <el-icon><Star /></el-icon>
                      我的收藏
                    </el-dropdown-item>
                    <el-dropdown-item v-if="userStore.isAdmin" command="admin" divided>
                      <el-icon><Setting /></el-icon>
                      后台管理
                    </el-dropdown-item>
                    <el-dropdown-item command="logout" divided>
                      <el-icon><SwitchButton /></el-icon>
                      退出登录
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
            <template v-else>
              <el-button text class="login-btn" @click="$router.push('/login')">登录</el-button>
              <el-button type="primary" round class="register-btn" @click="$router.push('/register')">
                注册账号
              </el-button>
            </template>
          </div>
        </div>
      </header>
      
      <!-- 主内容区域 -->
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
      
      <!-- 底部 - 简约设计 -->
      <footer class="footer">
        <div class="footer-container">
          <div class="footer-content">
            <div class="footer-links">
              <a href="javascript:;">关于我们</a>
              <span class="divider">•</span>
              <a href="javascript:;">联系我们</a>
              <span class="divider">•</span>
              <a href="javascript:;">服务协议</a>
              <span class="divider">•</span>
              <a href="javascript:;">隐私政策</a>
            </div>
            <p class="copyright">© 2024 编程狗社区 - 作品分享平台</p>
          </div>
        </div>
      </footer>
      
      <HCaptchaDialog ref="hcaptchaDialogRef" />
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'
import { useRouter } from 'vue-router'
import { ElMessage, ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { storeToRefs } from 'pinia'
import HCaptchaDialog from '@/components/HCaptchaDialog.vue'
import { hcaptchaApi } from '@/api/hcaptcha'
import { Search, EditPen, Bell, CaretBottom, User, Monitor, Star, Setting, SwitchButton } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { unreadCount } = storeToRefs(notificationStore)
const searchKeyword = ref('')
const hcaptchaDialogRef = ref(null)
const hcaptchaVerified = ref(false)

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2FhYyI+8J+RqOKAjfCfkrs8L3RleHQ+PC9zdmc+'

let isCheckingHCaptcha = false
let hcaptchaCheckInterval = null

const checkHCaptcha = async () => {
  if (isCheckingHCaptcha) return
  isCheckingHCaptcha = true
  
  try {
    const res = await hcaptchaApi.getStatus()
    if (res.code === 200 && res.data.required && !res.data.verified) {
      const result = await hcaptchaDialogRef.value.show()
      if (result) {
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
  if (userStore.token && !userStore.user) {
    await userStore.fetchCurrentUser()
  }
  if (userStore.isLoggedIn) {
    notificationStore.fetchUnreadCount()
  }
  await checkHCaptcha()
  
  window.addEventListener('hcaptcha-required', checkHCaptcha)
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

<style lang="scss" scoped>
.fade-transform-leave-active,
.fade-transform-enter-active {
  transition: all var(--duration-slow);
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

// 根容器
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

// 导航栏 - 现代化设计
.navbar {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: var(--shadow);
  position: sticky;
  top: 0;
  z-index: 1000;
  border-bottom: 1px solid var(--border-color);
  
  .navbar-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 var(--spacing);
    height: 68px;
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
  }
}

.logo-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex-shrink: 0;
  text-decoration: none;
  transition: transform var(--duration);
  
  &:hover {
    transform: scale(1.02);
  }
  
  .logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    box-shadow: var(--shadow-sm);
  }
  
  .logo-text {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-color);
    background: linear-gradient(135deg, var(--text-color), var(--text-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.3px;
  }
}

.nav-menu {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  
  .nav-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    font-size: 15px;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius-round);
    transition: all var(--duration);
    font-weight: 500;
    
    .nav-icon {
      font-size: 16px;
    }
    
    &:hover {
      color: var(--text-color);
      background: var(--primary-bg);
    }
    
    &.active {
      color: var(--text-color);
      background: var(--primary-color);
      font-weight: 600;
      box-shadow: var(--shadow-sm);
    }
  }
}

.search-wrap {
  flex: 1;
  max-width: 360px;
  
  :deep(.el-input__wrapper) {
    border-radius: var(--radius-round);
    background: var(--border-light);
    box-shadow: none;
    padding: 4px 16px;
    transition: all var(--duration);
    
    &.is-focus,
    &:hover {
      background: var(--white);
      box-shadow: 0 0 0 2px var(--primary-light), var(--shadow-sm);
    }
  }
  
  :deep(.el-input__inner) {
    height: 36px;
    font-size: 14px;
  }
}

.user-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  
  .notification-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    transition: all var(--duration);
    color: var(--text-secondary);
    
    &:hover {
      background: var(--primary-bg);
      color: var(--text-color);
      transform: scale(1.05);
    }
    
    .notification-badge {
      display: flex;
      align-items: center;
    }
  }
  
  .login-btn {
    color: var(--text-secondary);
    font-size: 15px;
    font-weight: 500;
    
    &:hover {
      color: var(--primary-color);
    }
  }
  
  .register-btn {
    padding: 10px 22px;
    font-weight: 600;
    border: none;
    font-size: 14px;
  }
  
  .publish-btn {
    padding: 10px 20px;
    font-weight: 600;
    border: none;
    font-size: 14px;
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    padding: 6px 10px;
    padding-right: 6px;
    border-radius: var(--radius-round);
    transition: all var(--duration);
    
    &:hover {
      background: var(--primary-bg);
    }
    
    .user-avatar {
      border: 2px solid var(--primary-light);
    }
    
    .user-meta {
      display: flex;
      flex-direction: column;
      gap: 1px;
      line-height: 1.2;
      
      .username {
        font-size: 14px;
        color: var(--text-color);
        font-weight: 600;
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .user-level {
        font-size: 11px;
        color: var(--primary-color);
        font-weight: 600;
        background: var(--primary-bg);
        padding: 1px 6px;
        border-radius: var(--radius-round);
        display: inline-block;
      }
    }
    
    .caret-icon {
      color: var(--text-muted);
      font-size: 14px;
    }
  }
}

.main-content {
  flex: 1;
  width: 100%;
}

// 底部 - 简约设计
.footer {
  background: var(--white);
  border-top: 1px solid var(--border-color);
  padding: var(--spacing-xl) 0;
  margin-top: auto;
  
  .footer-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 var(--spacing);
  }
  
  .footer-content {
    text-align: center;
  }
  
  .footer-links {
    margin-bottom: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    
    a {
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 500;
      
      &:hover {
        color: var(--primary-color);
      }
    }
    
    .divider {
      color: var(--text-muted);
      font-size: 12px;
    }
  }
  
  .copyright {
    color: var(--text-muted);
    font-size: 13px;
  }
}

// 响应式
@media (max-width: 1024px) {
  .nav-menu {
    display: none;
  }
}

@media (max-width: 768px) {
  .navbar-container {
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-sm);
  }
  
  .search-wrap {
    display: none;
  }
  
  .logo-text {
    display: none;
  }
  
  .user-wrap {
    gap: 10px;
  }
}
</style>

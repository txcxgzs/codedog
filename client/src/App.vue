<template>
  <el-config-provider :locale="zhCn">
  <div class="r-index--root_container">
    <!-- 顶部导航栏 -->
    <div class="c-navigator--navigator">
      <div class="c-navigator--header-content">
        <!-- Logo -->
        <a href="/" class="c-navigator--logo_wrap">
          <img src="https://static.codemao.cn/community/shequ_logo.png" alt="编程狗社区" class="c-navigator--logo_img">
          <span class="c-navigator--logo_text">编程狗社区</span>
        </a>
        
        <!-- 导航菜单 -->
        <ul class="c-navigator--nav_wrap">
          <li class="c-navigator--item" :class="{ 'c-navigator--selected': $route.path === '/' }">
            <router-link to="/">首页</router-link>
          </li>
          <li class="c-navigator--item" :class="{ 'c-navigator--selected': $route.path === '/works' }">
            <router-link to="/works">发现</router-link>
          </li>
          <li class="c-navigator--item" :class="{ 'c-navigator--selected': $route.path === '/community' }">
            <router-link to="/community">社区</router-link>
          </li>
          <li class="c-navigator--item" :class="{ 'c-navigator--selected': $route.path === '/work_shop' }">
            <router-link to="/work_shop">工作室</router-link>
          </li>
        </ul>
        
        <!-- 搜索框 -->
        <div class="c-navigator--search_wrap">
          <el-input
            v-model="searchKeyword"
            class="c-navigator--search_input"
            placeholder="搜索作品、用户"
            :prefix-icon="Search"
            @keyup.enter="handleSearch"
            clearable
          />
        </div>
        
        <!-- 用户区域 -->
        <div class="c-navigator--user_wrap">
          <template v-if="userStore.isLoggedIn">
            <el-button type="primary" round class="c-navigator--publish_btn" @click="$router.push('/publish')">
              <el-icon class="el-icon--left"><EditPen /></el-icon>
              发布作品
            </el-button>
            
            <!-- 通知图标 -->
            <div class="c-navigator--notification" @click="$router.push('/notifications')">
              <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount" class="c-navigator--badge_item">
                <el-icon :size="20" color="#666"><Bell /></el-icon>
              </el-badge>
            </div>
            
            <el-dropdown trigger="click" @command="handleCommand">
              <div class="c-navigator--user_info">
                <el-avatar :size="32" :src="userStore.user?.avatar || defaultAvatar" />
                <span class="c-navigator--username">{{ userStore.user?.nickname || userStore.user?.username }}</span>
                <el-icon class="el-icon--right"><CaretBottom /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile"><el-icon><User /></el-icon>个人中心</el-dropdown-item>
                  <el-dropdown-item command="myWorks"><el-icon><Monitor /></el-icon>我的作品</el-dropdown-item>
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
    
    <!-- 主内容区域 -->
    <div class="r-index--main_content">
      <router-view v-slot="{ Component }">
        <transition name="fade-transform" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
    
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

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

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
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 20px;
    transition: background 0.2s;
    
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
</style>

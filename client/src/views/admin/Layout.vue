<template>
  <div class="r-admin--layout">
    <!-- 侧边栏 -->
    <aside class="r-admin--sidebar">
      <div class="r-admin--logo">
        <img src="https://static.codemao.cn/community/shequ_logo.png" alt="编程狗社区" />
        <span>管理后台</span>
      </div>
      
      <el-menu
        :default-active="activeMenu"
        class="r-admin--menu"
        background-color="#1e1e2d"
        text-color="#b0b0b0"
        active-text-color="#FEC433"
        router
      >
        <el-menu-item index="/admin">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/works">
          <el-icon><Document /></el-icon>
          <span>作品管理</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/banners">
          <el-icon><Picture /></el-icon>
          <span>轮播图管理</span>
        </el-menu-item>
        
        <el-menu-item index="/admin/announcements">
          <el-icon><Bell /></el-icon>
          <span>公告管理</span>
        </el-menu-item>
      </el-menu>
      
      <div class="r-admin--sidebar_footer">
        <el-button text @click="$router.push('/')">
          <el-icon><Back /></el-icon>
          返回前台
        </el-button>
      </div>
    </aside>
    
    <!-- 主内容区 -->
    <div class="r-admin--main">
      <!-- 顶部栏 -->
      <header class="r-admin--header">
        <div class="r-admin--header_left">
          <h1 class="r-admin--page_title">{{ pageTitle }}</h1>
        </div>
        <div class="r-admin--header_right">
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="r-admin--user">
              <img :src="userStore.user?.avatar || defaultAvatar" />
              <span>{{ userStore.user?.nickname || userStore.user?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      
      <!-- 内容区 -->
      <main class="r-admin--content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { 
  DataAnalysis, User, Document, Picture, Bell, Back, ArrowDown 
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const activeMenu = computed(() => route.path)

const pageTitle = computed(() => {
  const titles = {
    '/admin': '数据概览',
    '/admin/users': '用户管理',
    '/admin/works': '作品管理',
    '/admin/banners': '轮播图管理',
    '/admin/announcements': '公告管理'
  }
  return titles[route.path] || '管理后台'
})

const handleCommand = (command) => {
  if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'logout') {
    userStore.logout()
    ElMessage.success('已退出登录')
    router.push('/')
  }
}
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$sidebar-bg: #1e1e2d;
$sidebar-width: 240px;

.r-admin--layout {
  display: flex;
  min-height: 100vh;
}

.r-admin--sidebar {
  width: $sidebar-width;
  background: $sidebar-bg;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  
  .r-admin--logo {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 20px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    
    img {
      height: 32px;
    }
    
    span {
      color: #fff;
      font-size: 16px;
      font-weight: 500;
    }
  }
  
  .r-admin--menu {
    flex: 1;
    border: none;
    
    :deep(.el-menu-item) {
      height: 50px;
      line-height: 50px;
      margin: 4px 12px;
      border-radius: 8px;
      
      &:hover {
        background: rgba(255,255,255,0.05);
      }
      
      &.is-active {
        background: rgba($primary-color, 0.1);
      }
    }
  }
  
  .r-admin--sidebar_footer {
    padding: 16px;
    border-top: 1px solid rgba(255,255,255,0.1);
    
    .el-button {
      width: 100%;
      color: #b0b0b0;
      justify-content: flex-start;
      
      &:hover {
        color: #fff;
      }
    }
  }
}

.r-admin--main {
  flex: 1;
  margin-left: $sidebar-width;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.r-admin--header {
  height: 64px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  position: sticky;
  top: 0;
  z-index: 50;
  
  .r-admin--page_title {
    font-size: 18px;
    font-weight: 600;
    color: #333;
    margin: 0;
  }
  
  .r-admin--user {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 20px;
    
    &:hover {
      background: #f5f5f5;
    }
    
    img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }
    
    span {
      color: #333;
      font-size: 14px;
    }
  }
}

.r-admin--content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}
</style>

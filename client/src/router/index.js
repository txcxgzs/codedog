/**
 * 路由配置
 * 定义应用的所有路由
 * 仅支持编程猫账号登录，无注册功能
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/works',
    name: 'Works',
    component: () => import('@/views/Works.vue'),
    meta: { title: '作品列表' }
  },
  {
    path: '/work/:codemaoId',
    name: 'WorkDetail',
    component: () => import('@/views/WorkDetail.vue'),
    meta: { title: '作品详情' }
  },
  {
    path: '/community',
    name: 'Community',
    component: () => import('@/views/Community.vue'),
    meta: { title: '社区' }
  },
  {
    path: '/post/:id',
    name: 'PostDetail',
    component: () => import('@/views/PostDetail.vue'),
    meta: { title: '帖子详情' }
  },
  {
    path: '/work_shop',
    name: 'Studio',
    component: () => import('@/views/Studio.vue'),
    meta: { title: '工作室' }
  },
  {
    path: '/studio/:id',
    name: 'StudioDetail',
    component: () => import('@/views/StudioDetail.vue'),
    meta: { title: '工作室详情' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/publish',
    name: 'Publish',
    component: () => import('@/views/Publish.vue'),
    meta: { title: '发布作品', requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: { title: '个人中心', requiresAuth: true }
  },
  {
    path: '/my-works',
    name: 'MyWorks',
    component: () => import('@/views/MyWorks.vue'),
    meta: { title: '我的作品', requiresAuth: true }
  },
  {
    path: '/favorites',
    name: 'Favorites',
    component: () => import('@/views/Favorites.vue'),
    meta: { title: '我的收藏', requiresAuth: true }
  },
  {
    path: '/user/:codemaoId',
    name: 'UserProfile',
    component: () => import('@/views/UserProfile.vue'),
    meta: { title: '用户主页' }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/Admin.vue'),
    meta: { title: '后台管理', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/init',
    name: 'AdminInit',
    component: () => import('@/views/admin/Init.vue'),
    meta: { title: '初始化说明' }
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: () => import('@/views/Notification.vue'),
    meta: { title: '消息通知', requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 编程狗社区` : '编程狗社区'
  
  const userStore = useUserStore()
  
  // 如果有 token 但没有用户信息，尝试获取用户信息
  if (userStore.token && !userStore.user) {
    try {
      await userStore.fetchCurrentUser()
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      userStore.logout()
      next({ name: 'Login', query: { redirect: to.fullPath } })
      return
    }
  }
  
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  
  if (to.meta.requiresAdmin && !userStore.isAdmin) {
    next({ name: 'Home' })
    return
  }
  
  next()
})

export default router

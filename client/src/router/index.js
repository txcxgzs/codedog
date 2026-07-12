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
    path: '/register',
    redirect: '/login'
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
    meta: { title: '初始化说明', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: () => import('@/views/Notification.vue'),
    meta: { title: '消息通知', requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    // 统一重定向到首页，避免复用 Home 组件导致标题/状态错乱
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 编程狗社区` : '编程狗社区'

  const userStore = useUserStore()

  // 已登录用户访问登录页时直接跳转首页，避免重复登录
  if (to.name === 'Login' && userStore.isLoggedIn) {
    next('/')
    return
  }

  // 修复: httpOnly cookie 模式下,token 初始为空,必须先调 /users/me 验证 cookie 是否有效
  // 没有用户信息时一律尝试获取(后端 cookie 自动携带)
  if (!userStore.user) {
    try {
      const user = await userStore.fetchCurrentUser()
      // fetchCurrentUser 返回 null 表示认证失败(401),需跳登录页
      if (!user && (to.meta.requiresAuth || to.meta.requiresAdmin)) {
        next({ name: 'Login', query: { redirect: to.fullPath } })
        return
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      // 网络错误时:若目标页不需要登录态则放行,否则跳登录页
      if (!to.meta.requiresAuth && !to.meta.requiresAdmin) {
        next()
      } else {
        next({ name: 'Login', query: { redirect: to.fullPath } })
      }
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

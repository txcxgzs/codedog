/**
 * 路由配置
 * 定义应用的所有路由
 * 仅支持编程猫账号登录，无注册功能
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import Home from '@/views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    // 首页与主入口一起发布，避免部署切换时旧页面请求已删除的异步首页 JS/CSS。
    component: Home,
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
    path: '/developer',
    name: 'Developer',
    component: () => import('@/views/developer/DeveloperHome.vue'),
    meta: { title: '开发者平台', requiresAuth: true }
  },
  {
    path: '/developer/docs',
    name: 'DeveloperDocs',
    component: () => import('@/views/developer/DeveloperDocs.vue'),
    meta: { title: '开发者文档', requiresAuth: true }
  },
  {
    path: '/oauth/authorize',
    name: 'OAuthAuthorize',
    component: () => import('@/views/OAuthAuthorize.vue'),
    meta: { title: '应用授权', requiresAuth: true }
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

// 部署后旧页面可能仍引用已经被新镜像替换的异步 chunk。
// 自动带缓存破坏参数刷新一次，避免只剩导航栏、路由区域完全空白。
router.onError((error) => {
  const message = String(error?.message || error || '')
  const isStaleChunk = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|CSS_CHUNK_LOAD_FAILED/i.test(message)
  if (!isStaleChunk) return

  const retryKey = 'codedog_asset_reload_at'
  const lastRetry = Number(sessionStorage.getItem(retryKey) || 0)
  if (Date.now() - lastRetry < 15000) return
  sessionStorage.setItem(retryKey, String(Date.now()))

  const url = new URL(window.location.href)
  url.searchParams.set('__refresh', String(Date.now()))
  window.location.replace(url.toString())
})

// 修复: 游客首次检测后即标记已检查,避免每次路由都发 /users/me 产生 401 spam
let authChecked = false

router.beforeEach(async (to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 编程狗社区` : '编程狗社区'

  const userStore = useUserStore()

  // 已登录用户访问登录页时直接跳转首页，避免重复登录
  if (to.name === 'Login' && userStore.isLoggedIn) {
    next('/')
    return
  }

  // 修复: httpOnly cookie 模式下,token 初始为空,必须先调 /users/me 验证 cookie 是否有效
  // 没有用户信息且未检查过时尝试获取(后端 cookie 自动携带)
  if (!userStore.user && !authChecked) {
    try {
      const user = await userStore.fetchCurrentUser()
      // fetchCurrentUser 返回 null 表示认证失败(401),确认为游客
      if (!user) {
        authChecked = true  // 只有 401 才标记已检查(网络错误不标记,下次路由重试)
        if (to.meta.requiresAuth || to.meta.requiresAdmin) {
          next({ name: 'Login', query: { redirect: to.fullPath } })
          return
        }
      } else {
        authChecked = true
        // 修复: 恢复登录态后若当前是登录页,跳转首页(避免 cookie 用户看到登录表单)
        if (to.name === 'Login') {
          next('/')
          return
        }
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      // 修复: 网络错误不标记 authChecked,下次路由会重试;仅 401 确认为游客
      if (error?.response?.status === 401) {
        authChecked = true
      }
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

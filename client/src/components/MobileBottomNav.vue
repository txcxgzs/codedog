<template>
  <nav class="mobile-nav" aria-label="手机端主导航">
    <router-link v-for="item in items" :key="item.to" :to="item.to" class="mobile-nav__item" :class="{ 'is-active': item.match(route.path) }">
      <el-icon><component :is="item.icon" /></el-icon>
      <span>{{ item.label }}</span>
    </router-link>
    <button class="mobile-nav__create" type="button" @click="goCreate" aria-label="发布作品">
      <span><el-icon><Plus /></el-icon></span>
      <b>创作</b>
    </button>
  </nav>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { HomeFilled, Compass, ChatDotRound, OfficeBuilding, User, Plus } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const items = [
  { label: '首页', to: '/', icon: HomeFilled, match: p => p === '/' },
  { label: '发现', to: '/works', icon: Compass, match: p => p.startsWith('/work') && !p.startsWith('/work_shop') },
  { label: '社区', to: '/community', icon: ChatDotRound, match: p => p.startsWith('/community') || p.startsWith('/post/') },
  { label: '工作室', to: '/work_shop', icon: OfficeBuilding, match: p => p.startsWith('/work_shop') || p.startsWith('/studio/') },
  { label: '我的', to: userStore.isLoggedIn ? '/profile' : '/login', icon: User, match: p => ['/profile','/login','/my-works','/favorites','/notifications'].some(x => p.startsWith(x)) }
]
const goCreate = () => router.push(userStore.isLoggedIn ? '/publish' : { path: '/login', query: { redirect: '/publish' } })
</script>

<style scoped>
.mobile-nav{display:none}
@media(max-width:768px){
  .mobile-nav{position:fixed;z-index:2200;left:10px;right:10px;bottom:max(8px,env(safe-area-inset-bottom));height:64px;padding:6px 4px;background:rgba(255,255,255,.94);border:1px solid rgba(214,222,235,.9);border-radius:18px;box-shadow:0 12px 38px rgba(22,34,57,.18);backdrop-filter:blur(18px);display:grid;grid-template-columns:repeat(6,1fr)}
  .mobile-nav__item{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#7a8597;font-size:10px;font-weight:600;transition:.18s ease}
  .mobile-nav__item :deep(.el-icon){font-size:20px}.mobile-nav__item.is-active{color:#172033}.mobile-nav__item.is-active :deep(.el-icon){color:#e5a900;transform:translateY(-1px)}
  .mobile-nav__item:nth-child(3){grid-column:4}.mobile-nav__item:nth-child(4){grid-column:5}.mobile-nav__item:nth-child(5){grid-column:6}
  .mobile-nav__create{position:absolute;left:50%;top:-18px;transform:translateX(-50%);border:0;background:transparent;color:#172033;font:700 10px/1 sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px}
  .mobile-nav__create span{width:46px;height:46px;border-radius:15px;background:linear-gradient(145deg,#ffd65d,#f5b615);display:grid;place-items:center;border:4px solid #fff;box-shadow:0 8px 18px rgba(224,162,0,.28)}.mobile-nav__create :deep(.el-icon){font-size:22px}
}
</style>

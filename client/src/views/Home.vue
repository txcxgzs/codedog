<template>
  <div class="r-home--home_page" @pointermove="moveAmbientGlow">
    <span class="r-home--mouse_glow" :style="mouseGlowStyle" aria-hidden="true" />
    <div class="r-home--container">
      <!-- 左侧主内容 -->
      <div class="r-home--main_column">
        <!-- 轮播图 -->
        <div class="r-home--banner_area" v-if="banners.length > 0">
          <el-carousel height="360px" :interval="5000" indicator-position="outside">
            <el-carousel-item v-for="banner in safeBanners" :key="banner.id">
              <a
                v-if="banner.safeLink"
                :href="banner.safeLink"
                target="_blank"
                rel="noopener noreferrer"
                class="r-home--banner_item"
              >
                <img :src="banner.safeImage" :alt="banner.title" referrerpolicy="no-referrer">
                <div class="r-home--banner_title">{{ banner.title }}</div>
              </a>
              <div v-else class="r-home--banner_item">
                <img :src="banner.safeImage" :alt="banner.title" referrerpolicy="no-referrer">
                <div class="r-home--banner_title">{{ banner.title }}</div>
              </div>
            </el-carousel-item>
          </el-carousel>
        </div>

        <!-- 推荐作品 -->
        <div class="r-home--section">
          <div class="r-home-c-section_header--section_header">
            <div class="r-home-c-section_header--title">
              <span class="r-home-c-section_header--icon r-home-c-section_header--recommend"></span>
              <span class="r-home-c-section_header--text">推荐作品</span>
            </div>
            <router-link to="/works" class="r-home-c-section_header--right_text">查看更多</router-link>
          </div>
          <div class="r-home--work_grid" v-loading="loadingFeatured">
            <a v-for="work in featuredWorks" :key="work.id" class="r-home-c-work_card--card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="r-home-c-work_card--cover">
                <div class="r-home-c-work_card--img" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="r-home-c-work_card--tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="r-home-c-work_card--body">
                <p class="r-home-c-work_card--title" :title="work.name">{{ work.name }}</p>
                <div class="r-home-c-work_card--bottom">
                  <span class="r-home-c-work_card--author" @click.stop="goUser(work.author)">{{ work.author?.nickname || work.author?.username }}</span>
                  <div class="r-home-c-work_card--stats">
                    <span>👁 {{ formatNum(work.view_times) }}</span>
                    <span>❤️ {{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </a>
          </div>
          <el-empty v-if="!loadingFeatured && featuredWorks.length === 0" description="暂无推荐作品" />
        </div>
        
        <!-- 最新作品 -->
        <div class="r-home--section">
          <div class="r-home-c-section_header--section_header">
            <div class="r-home-c-section_header--title">
              <span class="r-home-c-section_header--icon r-home-c-section_header--latest"></span>
              <span class="r-home-c-section_header--text">最新作品</span>
            </div>
            <router-link to="/works" class="r-home-c-section_header--right_text">查看更多</router-link>
          </div>
          <div class="r-home--work_grid" v-loading="loadingLatest">
            <a v-for="work in latestWorks" :key="work.id" class="r-home-c-work_card--card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="r-home-c-work_card--cover">
                <div class="r-home-c-work_card--img" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="r-home-c-work_card--tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="r-home-c-work_card--body">
                <p class="r-home-c-work_card--title" :title="work.name">{{ work.name }}</p>
                <div class="r-home-c-work_card--bottom">
                  <span class="r-home-c-work_card--author" @click.stop="goUser(work.author)">{{ work.author?.nickname || work.author?.username }}</span>
                  <div class="r-home-c-work_card--stats">
                    <span>👁 {{ formatNum(work.view_times) }}</span>
                    <span>❤️ {{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </a>
          </div>
          <el-empty v-if="!loadingLatest && latestWorks.length === 0" description="暂无作品" />
        </div>
        
        <!-- 热门作品 -->
        <div class="r-home--section">
          <div class="r-home-c-section_header--section_header">
            <div class="r-home-c-section_header--title">
              <span class="r-home-c-section_header--icon r-home-c-section_header--hot"></span>
              <span class="r-home-c-section_header--text">热门作品</span>
            </div>
            <router-link to="/works?sortBy=popular" class="r-home-c-section_header--right_text">查看更多</router-link>
          </div>
          <div class="r-home--work_grid" v-loading="loadingHot">
            <a v-for="work in hotWorks" :key="work.id" class="r-home-c-work_card--card" @click="$router.push(`/work/${work.codemao_work_id}`)">
              <div class="r-home-c-work_card--cover">
                <div class="r-home-c-work_card--img" :style="{ backgroundImage: `url(${work.preview})` }"></div>
                <span class="r-home-c-work_card--tag" v-if="work.type">{{ getTypeName(work.type) }}</span>
              </div>
              <div class="r-home-c-work_card--body">
                <p class="r-home-c-work_card--title" :title="work.name">{{ work.name }}</p>
                <div class="r-home-c-work_card--bottom">
                  <span class="r-home-c-work_card--author" @click.stop="goUser(work.author)">{{ work.author?.nickname || work.author?.username }}</span>
                  <div class="r-home-c-work_card--stats">
                    <span>👁 {{ formatNum(work.view_times) }}</span>
                    <span>❤️ {{ formatNum(work.praise_times) }}</span>
                  </div>
                </div>
              </div>
            </a>
          </div>
          <el-empty v-if="!loadingHot && hotWorks.length === 0" description="暂无作品" />
        </div>
      </div>
      
      <!-- 右侧边栏 -->
      <aside class="r-home--sidebar">
        <!-- 用户卡片 -->
        <div class="r-home--user_card" v-if="userStore.isLoggedIn">
          <div class="r-home--user_header">
            <AppImage :src="userStore.user?.avatar || defaultAvatar" :fallback="defaultAvatar" class="r-home--user_avatar" />
            <div class="r-home--user_info">
              <h4>{{ userStore.user?.nickname || userStore.user?.username }}</h4>
              <p>Lv.{{ userStore.user?.level || 1 }}</p>
            </div>
          </div>
          <p class="r-home--user_bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
          <el-button type="primary" class="r-home--publish_btn" @click="$router.push('/publish')">📝 发布作品</el-button>
        </div>
        
        <!-- 登录卡片 -->
        <div class="r-home--login_card" v-else>
          <h4>欢迎来到编程狗</h4>
          <p>登录后可以发布作品、评论互动</p>
          <el-button type="primary" @click="$router.push('/login')">立即登录</el-button>
        </div>
        
        <!-- 重要通知/官方帖子 -->
        <div class="r-home--side_card r-home--important_posts" v-if="importantPosts.length > 0">
          <h4>📢 重要通知</h4>
          <div class="r-home--post_list_sidebar">
            <div v-for="post in importantPosts" :key="post.id" class="r-home--post_item_sidebar important" @click="$router.push(`/post/${post.id}`)">
              <div class="r-home--post_title_sidebar"><el-tag size="small" type="danger" effect="plain" class="r-home--post_tag">重要</el-tag> {{ post.title }}</div>
              <div class="r-home--post_meta_sidebar">
                <span>{{ post.author?.nickname || post.author?.username }}</span>
                <span>{{ formatTime(post.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 精选帖子 (移至侧边栏) -->
        <div class="r-home--side_card r-home--featured_posts_sidebar" v-if="featuredPosts.length > 0">
          <h4>✨ 精选帖子</h4>
          <div class="r-home--post_list_sidebar">
            <div v-for="post in featuredPosts" :key="post.id" class="r-home--post_item_sidebar" @click="$router.push(`/post/${post.id}`)">
              <div class="r-home--post_title_sidebar">{{ post.title }}</div>
              <div class="r-home--post_meta_sidebar">
                <span>{{ post.author?.nickname || post.author?.username }}</span>
                <span>{{ formatNum(post.view_count) }}阅读</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 活跃用户 -->
        <div class="r-home--side_card r-home--active_users" v-if="activeUsers.length > 0">
          <h4>🏆 活跃大佬</h4>
          <div class="r-home--user_list">
            <div v-for="user in activeUsers" :key="user.id" class="r-home--user_item" @click="goUser(user)">
              <div class="r-home--user_avatar_wrap">
                <AppImage :src="user.avatar || defaultAvatar" :fallback="defaultAvatar" class="r-home--user_avatar_sm" />
                <span class="r-home--user_level_badge">Lv.{{ user.level }}</span>
              </div>
              <div class="r-home--user_info_sm">
                <span class="r-home--user_name" :title="user.nickname">{{ user.nickname || user.username }}</span>
                <span class="r-home--user_exp">经验: {{ user.experience }}</span>
              </div>
            </div>
          </div>
        </div>

        <div ref="magnetSentinel" class="r-home--magnet_sentinel" aria-hidden="true"></div>
        <div
          v-if="magnetWorks.length"
          class="r-home--magnet_dock"
          :class="{ 'is-magnetized': magnetRevealCount > 0 }"
          :aria-hidden="magnetRevealCount === 0"
        >
          <div class="r-home--magnet_heading">
            <span></span>
            <b>更多推荐</b>
            <i></i>
          </div>
          <a
            v-for="(work, index) in magnetWorks"
            :key="work.id"
            class="r-home--magnet_work"
            :class="{ 'is-visible': index < magnetRevealCount }"
            :style="{ '--magnet-index': index }"
            :tabindex="index < magnetRevealCount ? 0 : -1"
            @click="$router.push(`/work/${work.codemao_work_id}`)"
          >
            <span class="r-home--magnet_cover" :style="{ backgroundImage: `url(${work.preview})` }"></span>
            <span class="r-home--magnet_copy">
              <b :title="work.name">{{ work.name }}</b>
              <small>{{ work.author?.nickname || work.author?.username }}</small>
              <em><span>👁 {{ formatNum(work.view_times) }}</span><span>❤️ {{ formatNum(work.praise_times) }}</span></em>
            </span>
          </a>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { publicApi } from '@/api/public'
import { workApi } from '@/api/work'
import { postApi } from '@/api/post'
import AppImage from '@/components/AppImage.vue'

const router = useRouter()
const mouseGlowPosition = ref({ x: typeof window === 'undefined' ? 800 : window.innerWidth * .55, y: 360 })
let ambientFrame = 0
let pendingPointer = null
const mouseGlowStyle = computed(() => ({ transform: `translate3d(${mouseGlowPosition.value.x - 340}px, ${mouseGlowPosition.value.y - 340}px, 0)` }))
const moveAmbientGlow = event => {
  if (event.pointerType === 'touch') return
  pendingPointer = { x: event.clientX, y: event.clientY }
  if (ambientFrame) return
  ambientFrame = requestAnimationFrame(() => {
    mouseGlowPosition.value = pendingPointer
    ambientFrame = 0
  })
}
onUnmounted(() => { if (ambientFrame) cancelAnimationFrame(ambientFrame) })
const userStore = useUserStore()
const banners = ref([])
const announcements = ref([])
const featuredWorks = ref([])
const latestWorks = ref([])
const hotWorks = ref([])
const sidebarRecommendedWorks = ref([])
const activeUsers = ref([])
const featuredPosts = ref([])
const magnetSentinel = ref(null)
const magnetRevealCount = ref(0)
const magnetTargetCount = ref(0)
let magnetFrame = 0
let magnetStepTimer = 0

const importantPosts = ref([])
const loadingFeatured = ref(false)
const loadingLatest = ref(false)
const loadingHot = ref(false)
const magnetWorks = computed(() => (sidebarRecommendedWorks.value.length ? sidebarRecommendedWorks.value : hotWorks.value).slice(0, 8))

const runMagnetSteps = () => {
  if (magnetStepTimer || magnetRevealCount.value === magnetTargetCount.value) return
  const step = () => {
    magnetStepTimer = 0
    if (magnetRevealCount.value === magnetTargetCount.value) return
    magnetRevealCount.value += magnetTargetCount.value > magnetRevealCount.value ? 1 : -1
    if (magnetRevealCount.value !== magnetTargetCount.value) {
      magnetStepTimer = window.setTimeout(step, 82)
    }
  }
  step()
}

const syncMagnetDock = () => {
  if (magnetFrame) return
  magnetFrame = requestAnimationFrame(() => {
    const sentinelTop = magnetSentinel.value?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
    const revealDistance = Math.max(0, 92 - sentinelTop)
    magnetTargetCount.value = window.innerWidth > 1080
      ? Math.min(magnetWorks.value.length, Math.ceil(revealDistance / 52))
      : 0
    runMagnetSteps()
    magnetFrame = 0
  })
}

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const getSafeHttpUrl = (value) => {
  if (!value) return ''
  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.href
  } catch (e) {
    return ''
  }
}

const safeBanners = computed(() => {
  return banners.value
    .map((banner) => ({
      ...banner,
      safeImage: getSafeHttpUrl(banner.image_url),
      safeLink: getSafeHttpUrl(banner.link_url)
    }))
    .filter((banner) => banner.safeImage)
})

const formatNum = (n) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

const getTypeName = (workType) => {
  if (!workType) return ''
  const type = workType.toUpperCase()
  const typeMap = {
    'KITTEN': 'Kitten',
    'KITTEN4': 'KITTEN4',
    'NEMO': 'Nemo',
    'COCO': 'Coco',
    'WOOD': 'Wood',
    'BOX': 'Box',
    'BOX2': 'Box 2',
    'CODE_BLOCK': '代码岛',
    'PYTHON': 'Python',
    'SCRATCH': 'Scratch',
    'NEKO': 'Neko'
  }
  return typeMap[type] || workType
}

const goUser = (author) => {
  if (!author) return
  if (author.codemao_user_id) {
    router.push(`/user/${author.codemao_user_id}`)
  } else if (author.id) {
    router.push(`/user/${author.id}`)
  }
}

onMounted(async () => {
  window.addEventListener('scroll', syncMagnetDock, { passive: true })
  window.addEventListener('resize', syncMagnetDock, { passive: true })
  syncMagnetDock()
  // 侧边栏数据（并行加载）
  Promise.all([
    publicApi.getBanners().then(res => { if (res.code === 200) banners.value = res.data }).catch(() => {}),
    publicApi.getAnnouncements().then(res => { if (res.code === 200) announcements.value = res.data }).catch(() => {}),
    publicApi.getActiveUsers().then(res => { if (res.code === 200) activeUsers.value = res.data }).catch(() => {}),
    postApi.getPosts({ page: 1, pageSize: 4, category: 'essence' }).then(res => { if (res.code === 200) featuredPosts.value = res.data.list }).catch(() => {}),
    postApi.getPosts({ page: 1, pageSize: 2, isTop: true, category: 'official' }).then(res => { if (res.code === 200) importantPosts.value = res.data.list }).catch(() => {})
  ])

  // 作品数据（并行加载，立即显示 loading）
  loadingFeatured.value = true
  loadingLatest.value = true
  loadingHot.value = true

  Promise.all([
    workApi.getFeatured().then(res => {
      if (res.code === 200) featuredWorks.value = res.data.slice(0, 15)
    }).catch(() => {}).finally(() => { loadingFeatured.value = false }),

    workApi.getList({ page: 1, pageSize: 15 }).then(res => {
      if (res.code === 200) latestWorks.value = res.data.list
    }).catch(() => {}).finally(() => { loadingLatest.value = false }),

    workApi.getList({ page: 1, pageSize: 15, sortBy: 'popular' }).then(res => {
      if (res.code === 200) hotWorks.value = res.data.list
    }).catch(() => {}).finally(() => { loadingHot.value = false }),

    workApi.getSidebarRecommended().then(res => {
      if (res.code === 200) sidebarRecommendedWorks.value = res.data || []
    }).catch(() => {})
  ])
})

onUnmounted(() => {
  window.removeEventListener('scroll', syncMagnetDock)
  window.removeEventListener('resize', syncMagnetDock)
  if (magnetFrame) cancelAnimationFrame(magnetFrame)
  if (magnetStepTimer) window.clearTimeout(magnetStepTimer)
})
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$primary-hover: #FFD700;
$primary-light: #FFF9E6;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$bg-color: #f5f5f5;
$white: #fff;
$border-color: #eee;

:deep(.el-carousel__indicators--outside) {
  margin-top: 10px;
}

:deep(.el-carousel__button) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ccc;
  opacity: 1;
}

:deep(.is-active .el-carousel__button) {
  background-color: $primary-color;
  width: 20px;
  border-radius: 4px;
}

.r-home--home_page {
  min-height: calc(100vh - 60px);
  padding-bottom: 40px;
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(circle at 8% 12%, rgba(255, 205, 92, .28), transparent 24rem),
    radial-gradient(circle at 92% 18%, rgba(108, 190, 255, .24), transparent 26rem),
    linear-gradient(145deg, #f5f8ff 0%, #f9fbff 48%, #fff9ef 100%);
  background-attachment: fixed;
  overflow: clip;
}

.r-home--mouse_glow {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 0;
  width: 680px;
  height: 680px;
  border-radius: 50%;
  pointer-events: none;
  opacity: .34;
  filter: blur(10px);
  background: radial-gradient(circle, rgba(255, 226, 139, .5) 0, rgba(170, 218, 255, .24) 42%, transparent 72%);
  transition: transform .42s cubic-bezier(.2,.75,.25,1);
  will-change: transform;
}

.r-home--home_page::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: .45;
  background-image:
    linear-gradient(rgba(93, 134, 184, .07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(93, 134, 184, .07) 1px, transparent 1px),
    radial-gradient(circle at 22% 70%, rgba(255,255,255,.9) 0 2px, transparent 3px),
    radial-gradient(circle at 78% 42%, rgba(255,255,255,.8) 0 1.5px, transparent 2.5px);
  background-size: 42px 42px, 42px 42px, 180px 180px, 230px 230px;
  mask-image: linear-gradient(to bottom, #000, transparent 90%);
}

.r-home--container {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 20px 0;
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

@media (max-width: 768px), (prefers-reduced-motion: reduce) {
  .r-home--mouse_glow { display:none; }
}

.r-home--main_column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.r-home--sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: static;
  align-self: stretch;
}

.r-home--magnet_sentinel {
  width: 100%;
  height: 1px;
  margin-top: 2px;
  pointer-events: none;
}

.r-home--magnet_dock {
  position: sticky;
  top: 80px;
  z-index: 4;
  display: grid;
  gap: 10px;
  width: 100%;
  pointer-events: none;
}

.r-home--magnet_heading {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 4px 3px;
  opacity: 0;
  transform: translate3d(120px, 0, 0);
  transition: transform 460ms cubic-bezier(.18, .86, .22, 1.12), opacity 220ms ease;

  span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #fec433;
    box-shadow: 0 0 0 5px rgba(254, 196, 51, .17);
  }

  b {
    color: #202838;
    font-size: 17px;
    font-weight: 850;
    letter-spacing: .04em;
  }

  i {
    height: 1px;
    flex: 1;
    background: linear-gradient(90deg, rgba(254, 196, 51, .7), transparent);
  }
}

.r-home--magnet_work {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  min-height: 78px;
  overflow: hidden;
  border: 1px solid rgba(221, 226, 235, .94);
  border-radius: 14px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 13px 34px rgba(35, 51, 79, .12);
  color: #202838;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(min(480px, 42vw), calc((var(--magnet-index) - 1.5) * 18px), 0) rotate(calc((var(--magnet-index) - 1.5) * 1.6deg));
  transform-origin: right center;
  transition:
    transform 560ms cubic-bezier(.18, .86, .22, 1.12),
    opacity 230ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
  will-change: transform, opacity;

  &:hover {
    border-color: rgba(254, 196, 51, .78);
    box-shadow: 0 16px 38px rgba(35, 51, 79, .16);
    transform: translate3d(-4px, 0, 0) !important;
  }
}

.r-home--magnet_dock.is-magnetized {
  pointer-events: auto;

  .r-home--magnet_heading {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

}

.r-home--magnet_work.is-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0) rotate(0);
  pointer-events: auto;
  transition-delay: 0ms;
}

.r-home--magnet_cover {
  min-height: 78px;
  background-color: #edf1f7;
  background-position: center;
  background-size: cover;
}

.r-home--magnet_copy {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 4px;
  padding: 9px 11px;

  b,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  b {
    font-size: 13px;
    line-height: 1.25;
  }

  small {
    color: #9299a5;
    font-size: 10px;
  }

  em {
    display: flex;
    gap: 9px;
    color: #a4a9b1;
    font-size: 9px;
    font-style: normal;
  }
}

@media (max-width: 1080px) {
  .r-home--magnet_sentinel,
  .r-home--magnet_dock {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .r-home--magnet_work {
    transition: opacity 120ms ease;
    transform: none;
  }
}

.r-home--banner_area {
  width: 100%;
  
  :deep(.el-carousel) {
    border-radius: 18px;
    overflow: hidden;
    transform: translateZ(0); // 解决某些浏览器圆角溢出问题
    box-shadow: 0 16px 42px rgba(39,55,82,.12);
  }
}

.r-home--banner_item {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    border-radius: 12px;
  }
}

.r-home--banner_title {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  color: #fff;
  font-size: 14px;
}

.r-home--user_card {
  background: $white;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 12px 34px rgba(39,55,82,.08);
  
  .r-home--user_header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .r-home--user_avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid $primary-light;
  }
  
  .r-home--user_info {
    h4 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 600;
      color: $text-color;
    }
    
    p {
      margin: 0;
      font-size: 12px;
      color: $primary-color;
      font-weight: bold;
    }
  }
  
  .r-home--user_bio {
    margin: 0 0 16px;
    font-size: 13px;
    color: $text-secondary;
    line-height: 1.6;
    background: #f8f9fa;
    padding: 10px;
    border-radius: 8px;
    border-left: 3px solid $primary-color;
  }
  
  .r-home--publish_btn {
    width: 100%;
    height: 40px;
    font-weight: 600;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba($primary-color, 0.3);
  }
}

.r-home--login_card {
  background: linear-gradient(135deg, $primary-color 0%, $primary-hover 100%);
  border-radius: 8px;
  padding: 20px 16px;
  text-align: center;
  
  h4 {
    margin: 0 0 8px;
    font-size: 15px;
    color: $text-color;
  }
  
  p {
    margin: 0 0 12px;
    font-size: 12px;
    color: rgba(51, 51, 51, 0.7);
  }
  
  .el-button {
    background: $white;
    border-color: $white;
    color: $text-color;
  }
}

.r-home--side_card {
  background: $white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  
  h4 {
    margin: 0 0 16px;
    font-size: 15px;
    font-weight: 600;
    color: $text-color;
    padding-bottom: 12px;
    border-bottom: 2px solid $primary-light;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.r-home--tag_cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  
  .r-home--tag {
    padding: 6px 14px;
    background: #f5f6f7;
    border-radius: 8px;
    font-size: 12px;
    color: $text-secondary;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    
    &:hover {
      background: $primary-light;
      color: $primary-color;
      border-color: $primary-color;
      transform: translateY(-2px);
    }
  }
}

.r-home--user_list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  .r-home--user_item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid #f0f0f0;
    
    &:hover {
      background: #fcfcfc;
      border-color: $primary-color;
      transform: translateX(4px);
    }
    
    .r-home--user_avatar_wrap {
      position: relative;
      flex-shrink: 0;
      
      .r-home--user_avatar_sm {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        object-fit: cover;
      }
      
      .r-home--user_level_badge {
        position: absolute;
        bottom: -4px;
        right: -4px;
        background: $primary-color;
        color: $text-color;
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 10px;
        font-weight: bold;
        border: 2px solid #fff;
      }
    }
    
    .r-home--user_info_sm {
      display: flex;
      flex-direction: column;
      min-width: 0;
      
      .r-home--user_name {
        font-size: 14px;
        font-weight: 500;
        color: $text-color;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .r-home--user_exp {
        font-size: 11px;
        color: $text-muted;
        margin-top: 2px;
      }
    }
  }
}

.r-home--post_list_sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  .r-home--post_item_sidebar {
    padding: 10px;
    border-radius: 8px;
    background: #f8f9fa;
    cursor: pointer;
    transition: all 0.2s;
    border-left: 3px solid transparent;
    
    &:hover {
      background: #fff;
      border-left-color: $primary-color;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      transform: translateX(4px);
    }
    
    &.important {
      background: linear-gradient(to right, #fff9f0, #fff);
      margin: 4px 0;
      padding: 12px 8px;
      border-radius: 6px;
      border-left: none;
      
      &:hover {
        background: linear-gradient(to right, #fff4e0, #fff);
      }
    }
    
    .r-home--post_title_sidebar {
      font-size: 13px;
      font-weight: 500;
      color: $text-color;
      line-height: 1.4;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;

      .r-home--post_tag {
        margin-right: 4px;
        vertical-align: middle;
      }
    }
    
    .r-home--post_meta_sidebar {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: $text-muted;
    }
  }
}

.r-home--section {
  background: $white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.04);
}

.r-home-c-section_header--section_header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  .r-home-c-section_header--title {
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.r-home-c-section_header--icon {
  width: 24px;
  height: 24px;
  
  &.r-home-c-section_header--recommend {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FEC433'%3E%3Cpath d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/%3E%3C/svg%3E") no-repeat center;
    background-size: contain;
  }
  
  &.r-home-c-section_header--latest {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FEC433'%3E%3Cpath d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z'/%3E%3C/svg%3E") no-repeat center;
    background-size: contain;
  }
  
  &.r-home-c-section_header--hot {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FEC433'%3E%3Cpath d='M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z'/%3E%3C/svg%3E") no-repeat center;
    background-size: contain;
  }

  &.r-home-c-section_header--post {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FEC433'%3E%3Cpath d='M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z'/%3E%3C/svg%3E") no-repeat center;
    background-size: contain;
  }
}

.r-home-c-section_header--right_text {
  font-size: 14px;
  color: $text-secondary;
  
  &:hover {
    color: $primary-color;
  }
}

.r-home-c-work_card--card {
  display: block;
  background: $white;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  
  .r-home-c-work_card--cover {
    position: relative;
    padding-bottom: 100%; // 强制 1:1 比例
    background: #f0f0f0;
    
    .r-home-c-work_card--img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      transition: transform 0.3s;
    }
    
    &:hover .r-home-c-work_card--img {
      transform: scale(1.05);
    }
    
    .r-home-c-work_card--tag {
      position: absolute;
      top: 6px;
      left: 6px;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      color: #fff;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      z-index: 1;
    }
    
    .r-home-c-work_card--ide {
      position: absolute;
      bottom: 6px;
      right: 6px;
      background: $primary-color;
      color: $text-color;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      z-index: 1;
    }
  }
  
  .r-home-c-work_card--body {
    padding: 8px 10px; // 减小内边距，使白框更紧凑
    
    .r-home-c-work_card--title {
      font-size: 13px;
      color: $text-color;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
      line-height: 1.4;
    }
    
    .r-home-c-work_card--bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: $text-muted;
      
      .r-home-c-work_card--author {
        max-width: 70px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        
        &:hover {
          color: $primary-color;
        }
      }
      
      .r-home-c-work_card--stats {
        display: flex;
        gap: 6px;
        
        span {
          display: flex;
          align-items: center;
          gap: 2px;
        }
      }
    }
  }
}

.r-home--work_grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px; // 减小间距，更紧凑
  
  @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
}

.r-home--user_list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  .r-home--user_item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
    
    &:hover {
      background: #f9f9f9;
    }
    
    .r-home--user_avatar_wrap {
      position: relative;
      width: 40px;
      height: 40px;
      
      .r-home--user_avatar_sm {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
      }
      
      .r-home--user_level_badge {
        position: absolute;
        bottom: -2px;
        right: -4px;
        background: $primary-color;
        color: #fff;
        font-size: 10px;
        padding: 0 4px;
        border-radius: 4px;
        transform: scale(0.9);
      }
    }
    
    .r-home--user_info_sm {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      
      .r-home--user_name {
        font-size: 14px;
        color: $text-color;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .r-home--user_exp {
        font-size: 12px;
        color: $text-muted;
      }
    }
  }
}
</style>

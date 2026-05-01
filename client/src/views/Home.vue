<template>
  <div class="r-home--home_page">
    <div class="r-home--container">
      <!-- 左侧主内容 -->
      <div class="r-home--main_column">
        <!-- 轮播图 -->
        <div class="r-home--banner_area" v-if="banners.length > 0">
          <el-carousel height="360px" :interval="5000" indicator-position="outside">
            <el-carousel-item v-for="banner in banners" :key="banner.id">
              <a :href="banner.link_url" target="_blank" class="r-home--banner_item">
                <img :src="banner.image_url" :alt="banner.title">
                <div class="r-home--banner_title">{{ banner.title }}</div>
              </a>
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
            <img :src="userStore.user?.avatar || defaultAvatar" class="r-home--user_avatar" />
            <div class="r-home--user_info">
              <h4>{{ userStore.user?.nickname || userStore.user?.username }}</h4>
              <p>Lv.{{ userStore.user?.level || 1 }}</p>
            </div>
          </div>
          <p class="r-home--user_bio">{{ userStore.user?.bio || '这个人很懒，什么都没写~' }}</p>
          <el-button type="primary" class="r-home--publish_btn" @click="$router.push('/publish')">📝 发布作品</el-button>
          <div class="r-home--kittenn_wrapper">
            <span class="r-home--kittenn_ribbon">独立于编程猫提供的服务</span>
            <a href="javascript:;" class="r-home--kittenn_btn" @click.prevent="showKittennTip">
              🚀 使用 KittenN PLUS
            </a>
          </div>
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
                <img :src="user.avatar || defaultAvatar" class="r-home--user_avatar_sm" />
                <span class="r-home--user_level_badge">Lv.{{ user.level }}</span>
              </div>
              <div class="r-home--user_info_sm">
                <span class="r-home--user_name" :title="user.nickname">{{ user.nickname || user.username }}</span>
                <span class="r-home--user_exp">经验: {{ user.experience }}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { publicApi } from '@/api/public'
import { workApi } from '@/api/work'
import { postApi } from '@/api/post'

const router = useRouter()
const userStore = useUserStore()
const banners = ref([])
const announcements = ref([])
const featuredWorks = ref([])
const latestWorks = ref([])
const hotWorks = ref([])
const activeUsers = ref([])
const featuredPosts = ref([])

const showKittennTip = () => {
  ElMessage({
    message: '🚧 KittenN PLUS 正在开发中，敬请期待！',
    type: 'info',
    duration: 3000
  })
}
const importantPosts = ref([])
const loadingFeatured = ref(false)
const loadingLatest = ref(false)
const loadingHot = ref(false)

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

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
  try {
    const bRes = await publicApi.getBanners()
    if (bRes.code === 200) banners.value = bRes.data
  } catch (e) {}
  
  try {
    const aRes = await publicApi.getAnnouncements()
    if (aRes.code === 200) announcements.value = aRes.data
  } catch (e) {}

  try {
    const uRes = await publicApi.getActiveUsers()
    if (uRes.code === 200) activeUsers.value = uRes.data
  } catch (e) {}

  try {
    const pRes = await postApi.getPosts({ page: 1, pageSize: 4, category: 'essence' }) 
    if (pRes.code === 200) {
      featuredPosts.value = pRes.data.list
    }
  } catch (e) {
    console.error('Fetch Featured Posts Error:', e)
  }

  // 获取官方/重要通知 (置顶或官方分类)
  try {
    const impRes = await postApi.getPosts({ page: 1, pageSize: 2, isTop: true, category: 'official' })
    if (impRes.code === 200) {
      importantPosts.value = impRes.data.list
    }
  } catch (e) {
    console.error('Fetch Important Posts Error:', e)
  }
  
  loadingFeatured.value = true
  try {
    const res = await workApi.getFeatured()
    if (res.code === 200) featuredWorks.value = res.data.slice(0, 15)
  } catch (e) {}
  loadingFeatured.value = false
  
  loadingLatest.value = true
  try {
    const res = await workApi.getList({ page: 1, pageSize: 15 })
    if (res.code === 200) latestWorks.value = res.data.list
  } catch (e) {}
  loadingLatest.value = false
  
  loadingHot.value = true
  try {
    const res = await workApi.getList({ page: 1, pageSize: 15, sortBy: 'popular' })
    if (res.code === 200) hotWorks.value = res.data.list
  } catch (e) {}
  loadingHot.value = false
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
  min-height: 100%;
  padding-bottom: 40px;
}

.r-home--container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
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
  position: sticky;
  top: 80px;
}

.r-home--banner_area {
  width: 100%;
  
  :deep(.el-carousel) {
    border-radius: 12px;
    overflow: hidden;
    transform: translateZ(0); // 解决某些浏览器圆角溢出问题
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
  border-radius: 8px;
  padding: 16px;
  
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
  
  .r-home--kittenn_wrapper {
    position: relative;
    margin-top: 10px;
  }
  
  .r-home--kittenn_ribbon {
    position: absolute;
    top: -8px;
    right: -8px;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
    color: #fff;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    z-index: 1;
    box-shadow: 0 2px 6px rgba(238, 90, 90, 0.4);
    white-space: nowrap;
    
    &::before {
      content: '';
      position: absolute;
      left: -4px;
      bottom: -4px;
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 4px 4px 0 0;
      border-color: #cc4444 transparent transparent transparent;
    }
  }
  
  .r-home--kittenn_btn {
    display: block;
    width: 100%;
    height: 40px;
    line-height: 40px;
    text-align: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    cursor: pointer;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
      color: #fff;
    }
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

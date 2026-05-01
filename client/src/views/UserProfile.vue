<template>
  <div class="r-user--page" v-loading="loading">
    <div class="r-user--container" v-if="user">
      <!-- 用户信息卡片 -->
      <div class="r-user--profile_card">
        <div class="r-user--cover"></div>
        <div class="r-user--profile_content">
          <img :src="user.avatar || defaultAvatar" class="r-user--avatar" />
          <div class="r-user--info">
            <div class="r-user--name_row">
              <h1 class="r-user--nickname">{{ user.nickname || user.username }}</h1>
              <el-tag v-if="user.level" class="r-user--level" size="small">Lv.{{ user.level }}</el-tag>
            </div>
            <p class="r-user--bio">{{ user.bio || '这个人很懒，什么都没写~' }}</p>
            <p class="r-user--doing" v-if="user.doing">
              <span class="r-user--doing_icon"></span>
              {{ user.doing }}
            </p>
            <div class="r-user--stats">
              <div class="r-user--stat_item" @click="showFollowers">
                <span class="r-user--stat_num">{{ user.follower_count || 0 }}</span>
                <span class="r-user--stat_label">粉丝</span>
              </div>
              <div class="r-user--stat_item" @click="showFollowing">
                <span class="r-user--stat_num">{{ user.following_count || 0 }}</span>
                <span class="r-user--stat_label">关注</span>
              </div>
              <div class="r-user--stat_item">
                <span class="r-user--stat_num">{{ user.work_count || works.length }}</span>
                <span class="r-user--stat_label">作品</span>
              </div>
            </div>
            <div class="r-user--meta">
              <span>加入于 {{ formatTime(user.created_at) }}</span>
            </div>
          </div>
          <div class="r-user--actions">
            <template v-if="isCurrentUser">
              <el-button type="primary" @click="$router.push('/profile')">编辑资料</el-button>
            </template>
            <template v-else>
              <el-button 
                :type="isFollowing ? 'default' : 'primary'" 
                @click="toggleFollow"
                :loading="followLoading"
              >
                {{ isFollowing ? '已关注' : '关注' }}
              </el-button>
            </template>
          </div>
        </div>
      </div>
      
      <!-- 标签页 -->
      <div class="r-user--tabs">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="作品" name="works">
            <div class="r-user--works" v-loading="loadingWorks">
              <div class="r-user--works_grid" v-if="works.length > 0">
                <div 
                  v-for="work in works" 
                  :key="work.id" 
                  class="r-user--work_card"
                  @click="$router.push(`/work/${work.codemao_work_id}`)"
                >
                  <div class="r-user--work_cover" :style="{ backgroundImage: `url(${work.preview})` }">
                    <div class="r-user--work_overlay">
                      <span><span class="r-user--stat_icon r-user--stat_icon_view"></span>{{ work.view_times || 0 }}</span>
                      <span><span class="r-user--stat_icon r-user--stat_icon_like"></span>{{ work.praise_times || 0 }}</span>
                    </div>
                  </div>
                  <div class="r-user--work_body">
                    <h4 class="r-user--work_title">{{ work.name }}</h4>
                    <p class="r-user--work_time">{{ formatTime(work.created_at) }}</p>
                  </div>
                </div>
              </div>
              <el-empty v-else description="暂无作品" />
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="收藏" name="favorites" v-if="isCurrentUser">
            <div class="r-user--works" v-loading="loadingFavorites">
              <div class="r-user--works_grid" v-if="favorites.length > 0">
                <div 
                  v-for="work in favorites" 
                  :key="work.id" 
                  class="r-user--work_card"
                  @click="$router.push(`/work/${work.codemao_work_id}`)"
                >
                  <div class="r-user--work_cover" :style="{ backgroundImage: `url(${work.preview})` }">
                    <div class="r-user--work_overlay">
                      <span><span class="r-user--stat_icon r-user--stat_icon_view"></span>{{ work.view_times || 0 }}</span>
                      <span><span class="r-user--stat_icon r-user--stat_icon_like"></span>{{ work.praise_times || 0 }}</span>
                    </div>
                  </div>
                  <div class="r-user--work_body">
                    <h4 class="r-user--work_title">{{ work.name }}</h4>
                    <p class="r-user--work_author">{{ work.author?.nickname }}</p>
                  </div>
                </div>
              </div>
              <el-empty v-else description="暂无收藏" />
            </div>
          </el-tab-pane>
          
          <el-tab-pane :label="`粉丝 ${user.follower_count || 0}`" name="followers">
            <div class="r-user--user_list" v-loading="loadingFollowers">
              <div v-for="u in followers" :key="u.id" class="r-user--user_item" @click="$router.push(`/user/${u.codemao_user_id}`)">
                <img :src="u.avatar || defaultAvatar" class="r-user--user_avatar" />
                <div class="r-user--user_info">
                  <span class="r-user--user_name">{{ u.nickname || u.username }}</span>
                  <span class="r-user--user_bio">{{ u.bio || '暂无简介' }}</span>
                </div>
                <div class="r-user--user_stats">
                  <span>{{ u.work_count || 0 }} 作品</span>
                  <span>{{ u.follower_count || 0 }} 粉丝</span>
                </div>
              </div>
              <el-empty v-if="!loadingFollowers && followers.length === 0" description="暂无粉丝" />
            </div>
          </el-tab-pane>
          
          <el-tab-pane :label="`关注 ${user.following_count || 0}`" name="following">
            <div class="r-user--user_list" v-loading="loadingFollowing">
              <div v-for="u in following" :key="u.id" class="r-user--user_item" @click="$router.push(`/user/${u.codemao_user_id}`)">
                <img :src="u.avatar || defaultAvatar" class="r-user--user_avatar" />
                <div class="r-user--user_info">
                  <span class="r-user--user_name">{{ u.nickname || u.username }}</span>
                  <span class="r-user--user_bio">{{ u.bio || '暂无简介' }}</span>
                </div>
                <div class="r-user--user_stats">
                  <span>{{ u.work_count || 0 }} 作品</span>
                  <span>{{ u.follower_count || 0 }} 粉丝</span>
                </div>
              </div>
              <el-empty v-if="!loadingFollowing && following.length === 0" description="暂无关注" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
    
    <el-empty v-else-if="!loading" description="用户不存在" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { userApi } from '@/api/user'
import { workApi } from '@/api/work'
import { favoriteApi } from '@/api/favorite'
import { followApi } from '@/api/follow'
import { ElMessage } from 'element-plus'

const route = useRoute()
const userStore = useUserStore()
const loading = ref(true)
const loadingWorks = ref(false)
const loadingFavorites = ref(false)
const loadingFollowers = ref(false)
const loadingFollowing = ref(false)
const followLoading = ref(false)
const isFollowing = ref(false)
const user = ref(null)
const works = ref([])
const favorites = ref([])
const followers = ref([])
const following = ref([])
const activeTab = ref('works')

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const isCurrentUser = computed(() => String(userStore.user?.id) === String(user.value?.id))

const formatTime = (time) => {
  if (!time) return '未知'
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fetchUser = async () => {
  const codemaoId = route.params.codemaoId
  if (!codemaoId) return
  
  loading.value = true
  try {
    const res = await userApi.getUserById(codemaoId)
    if (res.code === 200) {
      user.value = res.data
      fetchWorks()
      checkFollow()
    }
  } catch (error) {
    console.error('获取用户失败:', error)
  } finally {
    loading.value = false
  }
}

const fetchWorks = async () => {
  if (!user.value?.id) return
  loadingWorks.value = true
  try {
    const res = await workApi.getUserWorks(user.value.id, { page: 1, pageSize: 20 })
    if (res.code === 200) {
      works.value = res.data.list
    }
  } catch (error) {
    console.error('获取作品失败:', error)
  } finally {
    loadingWorks.value = false
  }
}

const fetchFavorites = async () => {
  loadingFavorites.value = true
  try {
    const res = await favoriteApi.getMyFavorites({ page: 1, pageSize: 20 })
    if (res.code === 200) {
      favorites.value = res.data.list
    }
  } catch (error) {
    console.error('获取收藏失败:', error)
  } finally {
    loadingFavorites.value = false
  }
}

const checkFollow = async () => {
  if (!userStore.isLoggedIn || isCurrentUser.value || !user.value?.codemao_user_id) return
  try {
    const res = await followApi.check(user.value.codemao_user_id)
    if (res.code === 200) {
      isFollowing.value = res.data.isFollowing
    }
  } catch (error) {
    console.error('检查关注失败:', error)
  }
}

const toggleFollow = async () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  
  followLoading.value = true
  try {
    if (isFollowing.value) {
      const res = await followApi.unfollow(user.value.codemao_user_id)
      if (res.code === 200) {
        isFollowing.value = false
        user.value.follower_count = Math.max(0, (user.value.follower_count || 0) - 1)
        ElMessage.success('已取消关注')
      }
    } else {
      const res = await followApi.follow(user.value.codemao_user_id)
      if (res.code === 200) {
        isFollowing.value = true
        user.value.follower_count = (user.value.follower_count || 0) + 1
        ElMessage.success('关注成功')
      }
    }
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    followLoading.value = false
  }
}

const showFollowers = () => {
  activeTab.value = 'followers'
  fetchFollowers()
}

const showFollowing = () => {
  activeTab.value = 'following'
  fetchFollowing()
}

const fetchFollowers = async () => {
  if (!user.value?.codemao_user_id || followers.value.length > 0) return
  loadingFollowers.value = true
  try {
    const res = await followApi.getFollowers(user.value.codemao_user_id, { page: 1, pageSize: 50 })
    if (res.code === 200) {
      followers.value = res.data.list
    }
  } catch (error) {
    console.error('获取粉丝失败:', error)
  } finally {
    loadingFollowers.value = false
  }
}

const fetchFollowing = async () => {
  if (!user.value?.codemao_user_id || following.value.length > 0) return
  loadingFollowing.value = true
  try {
    const res = await followApi.getFollowing(user.value.codemao_user_id, { page: 1, pageSize: 50 })
    if (res.code === 200) {
      following.value = res.data.list
    }
  } catch (error) {
    console.error('获取关注失败:', error)
  } finally {
    loadingFollowing.value = false
  }
}

watch(() => route.params.codemaoId, fetchUser)
onMounted(fetchUser)
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$primary-hover: #FFD700;
$primary-light: #FFF9E6;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$white: #fff;
$border-color: #eee;

.r-user--page {
  min-height: calc(100vh - 60px);
  background: #f5f5f5;
}

.r-user--container {
  max-width: 1000px;
  margin: 0 auto;
}

.r-user--profile_card {
  background: $white;
  border-radius: 0 0 16px 16px;
  overflow: hidden;
  
  .r-user--cover {
    height: 120px;
    background: linear-gradient(135deg, $primary-color 0%, $primary-hover 100%);
  }
  
  .r-user--profile_content {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    padding: 0 32px 24px;
    margin-top: -40px;
    
    @media (max-width: 768px) {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  }
  
  .r-user--avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 4px solid $white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    flex-shrink: 0;
  }
  
  .r-user--info {
    flex: 1;
    padding-top: 48px;
    
    .r-user--name_row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .r-user--nickname {
      font-size: 24px;
      font-weight: 600;
      color: $text-color;
      margin: 0;
    }
    
    .r-user--level {
      background: $primary-color;
      color: $text-color;
      border: none;
      border-radius: 10px;
    }
    
    .r-user--bio {
      font-size: 14px;
      color: $text-secondary;
      margin: 0 0 8px;
      line-height: 1.6;
    }
    
    .r-user--doing {
      font-size: 13px;
      color: $text-muted;
      margin: 0 0 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      
      .r-user--doing_icon {
        width: 14px;
        height: 14px;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
    }
    
    .r-user--stats {
      display: flex;
      gap: 32px;
      margin-bottom: 12px;
      
      .r-user--stat_item {
        display: flex;
        flex-direction: column;
        cursor: pointer;
        
        &:hover .r-user--stat_num {
          color: $primary-color;
        }
        
        .r-user--stat_num {
          font-size: 20px;
          font-weight: 600;
          color: $text-color;
          transition: color 0.2s;
        }
        
        .r-user--stat_label {
          font-size: 12px;
          color: $text-muted;
        }
      }
    }
    
    .r-user--meta {
      font-size: 13px;
      color: $text-muted;
    }
  }
  
  .r-user--actions {
    padding-top: 52px;
    
    .el-button--primary {
      background: $primary-color;
      border-color: $primary-color;
      color: $text-color;
      border-radius: 20px;
      
      &:hover {
        background: $primary-hover;
        border-color: $primary-hover;
      }
    }
    
    .el-button--default {
      border-radius: 20px;
    }
  }
}

.r-user--tabs {
  background: $white;
  border-radius: 16px;
  margin: 20px;
  padding: 20px;
  
  :deep(.el-tabs__item) {
    font-size: 15px;
    
    &.is-active {
      color: $primary-color;
    }
  }
  
  :deep(.el-tabs__active-bar) {
    background: $primary-color;
  }
}

.r-user--works {
  min-height: 200px;
}

.r-user--works_grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  
  @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 576px) { grid-template-columns: 1fr; }
}

.r-user--work_card {
  background: $white;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid $border-color;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    
    .r-user--work_overlay {
      opacity: 1;
    }
  }
  
  .r-user--work_cover {
    padding-top: 100%;
    background-size: cover;
    background-position: center;
    position: relative;
    
    .r-user--work_overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      opacity: 0;
      transition: opacity 0.3s;
      
      span {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #fff;
        font-size: 14px;
      }
      
      .r-user--stat_icon {
        width: 16px;
        height: 16px;
        
        &.r-user--stat_icon_view {
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fff'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E") no-repeat center;
          background-size: contain;
        }
        
        &.r-user--stat_icon_like {
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fff'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
          background-size: contain;
        }
      }
    }
  }
  
  .r-user--work_body {
    padding: 12px;
    
    .r-user--work_title {
      font-size: 14px;
      font-weight: 500;
      color: $text-color;
      margin: 0 0 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .r-user--work_time, .r-user--work_author {
      font-size: 12px;
      color: $text-muted;
      margin: 0;
    }
  }
}

.r-user--user_list {
  min-height: 200px;
}

.r-user--user_item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid $border-color;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: #f9f9f9;
  }
  
  .r-user--user_avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .r-user--user_info {
    flex: 1;
    min-width: 0;
    
    .r-user--user_name {
      font-size: 15px;
      font-weight: 500;
      color: $text-color;
      display: block;
    }
    
    .r-user--user_bio {
      font-size: 13px;
      color: $text-muted;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  
  .r-user--user_stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: $text-muted;
  }
}
</style>

<template>
  <div class="r-dashboard--page">
    <!-- 统计卡片 -->
    <div class="r-dashboard--stats">
      <div class="r-dashboard--stat_card">
        <div class="r-dashboard--stat_icon r-dashboard--stat_icon_users"></div>
        <div class="r-dashboard--stat_info">
          <p class="r-dashboard--stat_value">{{ stats.userCount || 0 }}</p>
          <p class="r-dashboard--stat_label">用户总数</p>
        </div>
      </div>
      
      <div class="r-dashboard--stat_card">
        <div class="r-dashboard--stat_icon r-dashboard--stat_icon_works"></div>
        <div class="r-dashboard--stat_info">
          <p class="r-dashboard--stat_value">{{ stats.workCount || 0 }}</p>
          <p class="r-dashboard--stat_label">作品总数</p>
        </div>
      </div>
      
      <div class="r-dashboard--stat_card">
        <div class="r-dashboard--stat_icon r-dashboard--stat_icon_views"></div>
        <div class="r-dashboard--stat_info">
          <p class="r-dashboard--stat_value">{{ stats.viewCount || 0 }}</p>
          <p class="r-dashboard--stat_label">总浏览量</p>
        </div>
      </div>
      
      <div class="r-dashboard--stat_card">
        <div class="r-dashboard--stat_icon r-dashboard--stat_icon_likes"></div>
        <div class="r-dashboard--stat_info">
          <p class="r-dashboard--stat_value">{{ stats.likeCount || 0 }}</p>
          <p class="r-dashboard--stat_label">总点赞数</p>
        </div>
      </div>
    </div>
    
    <!-- 快捷操作 -->
    <div class="r-dashboard--section">
      <h3 class="r-dashboard--section_title">快捷操作</h3>
      <div class="r-dashboard--quick_actions">
        <el-button type="primary" @click="$router.push('/admin/users')">
          <el-icon><User /></el-icon>
          管理用户
        </el-button>
        <el-button type="primary" @click="$router.push('/admin/works')">
          <el-icon><Document /></el-icon>
          管理作品
        </el-button>
        <el-button type="primary" @click="$router.push('/admin/banners')">
          <el-icon><Picture /></el-icon>
          管理轮播图
        </el-button>
        <el-button type="primary" @click="$router.push('/admin/announcements')">
          <el-icon><Bell /></el-icon>
          管理公告
        </el-button>
      </div>
    </div>
    
    <!-- 最新作品 -->
    <div class="r-dashboard--section">
      <h3 class="r-dashboard--section_title">最新作品</h3>
      <el-table :data="latestWorks" v-loading="loadingWorks" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="作品名称" min-width="200" />
        <el-table-column label="作者" width="150">
          <template #default="{ row }">
            {{ row.author?.nickname || row.author?.username }}
          </template>
        </el-table-column>
        <el-table-column prop="view_times" label="浏览" width="100" />
        <el-table-column prop="praise_times" label="点赞" width="100" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <!-- 最新用户 -->
    <div class="r-dashboard--section">
      <h3 class="r-dashboard--section_title">最新用户</h3>
      <el-table :data="latestUsers" v-loading="loadingUsers" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="头像" width="80">
          <template #default="{ row }">
            <img :src="row.avatar || defaultAvatar" class="r-dashboard--avatar" />
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="nickname" label="昵称" width="150" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'info'">
              {{ row.role === 'admin' ? '管理员' : '用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/admin'
import { User, Document, Picture, Bell } from '@element-plus/icons-vue'

const loadingWorks = ref(false)
const loadingUsers = ref(false)
const stats = ref({})
const latestWorks = ref([])
const latestUsers = ref([])

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const formatTime = (time) => {
  if (!time) return '-'
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fetchStats = async () => {
  try {
    const res = await adminApi.getStats()
    if (res.code === 200) {
      stats.value = res.data
    }
  } catch (e) {
    console.error('获取统计失败:', e)
  }
}

const fetchLatestWorks = async () => {
  loadingWorks.value = true
  try {
    const res = await adminApi.getWorks({ page: 1, pageSize: 5 })
    if (res.code === 200) {
      latestWorks.value = res.data.list
    }
  } catch (e) {
    console.error('获取作品失败:', e)
  } finally {
    loadingWorks.value = false
  }
}

const fetchLatestUsers = async () => {
  loadingUsers.value = true
  try {
    const res = await adminApi.getUsers({ page: 1, pageSize: 5 })
    if (res.code === 200) {
      latestUsers.value = res.data.list
    }
  } catch (e) {
    console.error('获取用户失败:', e)
  } finally {
    loadingUsers.value = false
  }
}

onMounted(() => {
  fetchStats()
  fetchLatestWorks()
  fetchLatestUsers()
})
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;

.r-dashboard--page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.r-dashboard--stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  
  @media (max-width: 992px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 576px) { grid-template-columns: 1fr; }
}

.r-dashboard--stat_card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  
  .r-dashboard--stat_icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &.r-dashboard--stat_icon_users {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    &.r-dashboard--stat_icon_works {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    
    &.r-dashboard--stat_icon_views {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    
    &.r-dashboard--stat_icon_likes {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
  }
  
  .r-dashboard--stat_info {
    .r-dashboard--stat_value {
      font-size: 28px;
      font-weight: 700;
      color: #333;
      margin: 0;
    }
    
    .r-dashboard--stat_label {
      font-size: 14px;
      color: #999;
      margin: 4px 0 0;
    }
  }
}

.r-dashboard--section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  
  .r-dashboard--section_title {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin: 0 0 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #eee;
  }
}

.r-dashboard--quick_actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  
  .el-button {
    border-radius: 8px;
  }
}

.r-dashboard--avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}
</style>

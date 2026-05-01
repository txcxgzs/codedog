<template>
  <div class="r-myworks--page">
    <div class="r-myworks--container">
      <div class="r-myworks--header">
        <h2 class="r-myworks--title">我的作品</h2>
        <el-button type="primary" class="r-myworks--publish_btn" @click="$router.push('/publish')">
          <span class="r-myworks--publish_icon"></span>
          发布新作品
        </el-button>
      </div>
      
      <div class="r-myworks--content" v-loading="loading">
        <div class="r-myworks--grid" v-if="works.length > 0">
          <div v-for="work in works" :key="work.id" class="r-myworks--card">
            <div class="r-myworks--card_cover" :style="{ backgroundImage: `url(${work.preview})` }">
              <div class="r-myworks--card_overlay">
                <el-button type="primary" size="small" @click="$router.push(`/work/${work.codemao_work_id}`)">查看</el-button>
                <el-button type="danger" size="small" @click="deleteWork(work)">删除</el-button>
              </div>
            </div>
            <div class="r-myworks--card_body">
              <h4 class="r-myworks--card_title">{{ work.name }}</h4>
              <p class="r-myworks--card_time">{{ formatTime(work.created_at) }}</p>
              <div class="r-myworks--card_stats">
                <span><span class="r-myworks--stat_icon r-myworks--stat_icon_view"></span>{{ work.view_times || 0 }}</span>
                <span><span class="r-myworks--stat_icon r-myworks--stat_icon_like"></span>{{ work.praise_times || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <el-empty v-else description="暂无作品，快去发布吧！">
          <el-button type="primary" @click="$router.push('/publish')">发布作品</el-button>
        </el-empty>
        
        <div class="r-myworks--pagination" v-if="total > pageSize">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next"
            @current-change="fetchWorks"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { workApi } from '@/api/work'
import { ElMessage, ElMessageBox } from 'element-plus'

const userStore = useUserStore()
const loading = ref(false)
const works = ref([])
const currentPage = ref(1)
const pageSize = ref(12)
const total = ref(0)

const formatTime = (time) => {
  if (!time) return ''
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fetchWorks = async () => {
  loading.value = true
  try {
    const res = await workApi.getMyWorks({
      page: currentPage.value,
      pageSize: pageSize.value
    })
    if (res.code === 200) {
      works.value = res.data.list
      total.value = res.data.total
    }
  } catch (error) {
    console.error('获取作品失败:', error)
  } finally {
    loading.value = false
  }
}

const deleteWork = async (work) => {
  try {
    await ElMessageBox.confirm('确定要删除这个作品吗？', '提示', {
      type: 'warning'
    })
    const res = await workApi.delete(work.codemao_work_id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchWorks()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(fetchWorks)
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

.r-myworks--page {
  padding: 24px;
  min-height: calc(100vh - 60px);
}

.r-myworks--container {
  max-width: 1200px;
  margin: 0 auto;
}

.r-myworks--header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  .r-myworks--title {
    font-size: 24px;
    font-weight: 600;
    color: $text-color;
    margin: 0;
  }
  
  .r-myworks--publish_btn {
    background: $primary-color;
    border-color: $primary-color;
    color: $text-color;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
    
    &:hover {
      background: $primary-hover;
      border-color: $primary-hover;
    }
    
    .r-myworks--publish_icon {
      width: 14px;
      height: 14px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23333'%3E%3Cpath d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
  }
}

.r-myworks--content {
  background: $white;
  border-radius: 12px;
  padding: 24px;
  min-height: 400px;
}

.r-myworks--grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  
  @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 576px) { grid-template-columns: 1fr; }
}

.r-myworks--card {
  background: $white;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid $border-color;
  transition: all 0.3s;
  
  &:hover {
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
    border-color: transparent;
    
    .r-myworks--card_overlay {
      opacity: 1;
    }
  }
  
  .r-myworks--card_cover {
    padding-top: 100%;
    background-size: cover;
    background-position: center;
    position: relative;
    
    .r-myworks--card_overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      opacity: 0;
      transition: opacity 0.3s;
    }
  }
  
  .r-myworks--card_body {
    padding: 12px;
    
    .r-myworks--card_title {
      font-size: 14px;
      font-weight: 500;
      color: $text-color;
      margin: 0 0 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .r-myworks--card_time {
      font-size: 12px;
      color: $text-muted;
      margin: 0 0 8px;
    }
    
    .r-myworks--card_stats {
      display: flex;
      gap: 16px;
      
      span {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: $text-muted;
      }
      
      .r-myworks--stat_icon {
        width: 14px;
        height: 14px;
        
        &.r-myworks--stat_icon_view {
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E") no-repeat center;
          background-size: contain;
        }
        
        &.r-myworks--stat_icon_like {
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
          background-size: contain;
        }
      }
    }
  }
}

.r-myworks--pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>

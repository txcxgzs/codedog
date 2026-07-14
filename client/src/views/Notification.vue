<template>
  <div class="r-notification--page">
    <div class="r-notification--container">
      <div class="r-notification--header">
        <h2>消息通知</h2>
        <div class="r-notification--actions">
          <el-button text @click="markAllAsRead" :disabled="!notifications.some(n => !n.is_read)">
            全部已读
          </el-button>
          <el-button text @click="clearAll" :disabled="notifications.length === 0">
            清空
          </el-button>
        </div>
      </div>
      
      <div class="r-notification--tabs">
        <span :class="{ active: activeType === '' }" @click="changeType('')">全部</span>
        <span :class="{ active: activeType === 'like' }" @click="changeType('like')">点赞</span>
        <span :class="{ active: activeType === 'comment' }" @click="changeType('comment')">评论</span>
        <span :class="{ active: activeType === 'reply' }" @click="changeType('reply')">回复</span>
        <span :class="{ active: activeType === 'follow' }" @click="changeType('follow')">关注</span>
        <span :class="{ active: activeType === 'system' }" @click="changeType('system')">系统</span>
      </div>
      
      <div class="r-notification--list" v-loading="loading">
        <div 
          v-for="item in notifications" 
          :key="item.id" 
          class="r-notification--item"
          :class="{ unread: !item.is_read }"
          @click="handleClick(item)"
        >
          <div class="r-notification--avatar">
            <AppImage v-if="item.sender?.avatar" :src="item.sender.avatar" :fallback="defaultAvatar" />
            <span v-else class="r-notification--icon" :class="`r-notification--icon_${item.type}`"></span>
          </div>
          <div class="r-notification--content">
            <div class="r-notification--title">
              <span class="r-notification--sender" v-if="item.sender">
                {{ item.sender.nickname || item.sender.username }}
              </span>
              {{ item.title }}
            </div>
            <div class="r-notification--text" v-if="item.content">{{ item.content }}</div>
            <div class="r-notification--time">{{ formatTime(item.created_at) }}</div>
          </div>
          <div class="r-notification--actions">
            <el-button text size="small" @click.stop="deleteNotification(item)">
              删除
            </el-button>
          </div>
        </div>
        
        <el-empty v-if="!loading && notifications.length === 0" description="暂无通知" />
      </div>
      
      <div class="r-notification--pagination" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="fetchNotifications"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notification'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { relativeTime as relativeTimeFmt } from '@/utils/format'
import AppImage from '@/components/AppImage.vue'

// 默认头像：sender 无 avatar 时作为 AppImage 的 fallback 显示
const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const router = useRouter()
const notificationStore = useNotificationStore()
const { notifications, unreadCount, loading } = storeToRefs(notificationStore)

const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const activeType = ref('')

// 复用统一的时间格式化工具，避免多处重复实现导致时区处理不一致
const formatTime = (time) => relativeTimeFmt(time)

const fetchNotifications = async () => {
  const res = await notificationStore.fetchNotifications({
    page: page.value,
    pageSize: pageSize.value,
    type: activeType.value
  })
  if (res) {
    total.value = res.pagination?.total || 0
  }
}

const changeType = (type) => {
  activeType.value = type
  page.value = 1
  fetchNotifications()
}

const handleClick = async (item) => {
  if (!item.is_read) {
    await notificationStore.markAsRead(item.id)
  }

  // 系统通知（如举报处理结果）不跳转
  if (item.type === 'system' && !item.related_type) {
    return
  }

  // 有关联内容的通知才跳转
  if (item.related_type && item.related_id) {
    // 被处理的内容（帖子/作品被删除）不跳转
    if (item.title?.includes('已被处理') || item.title?.includes('已处理')) {
      ElMessage.info('该内容已被处理')
      return
    }
    router.push(`/${item.related_type}/${item.related_id}`)
  }
}

const deleteNotification = async (item) => {
  try {
    await ElMessageBox.confirm('确定删除这条通知吗？', '提示', { type: 'warning' })
    await notificationStore.deleteNotification(item.id)
  } catch (e) {}
}

const markAllAsRead = async () => {
  await notificationStore.markAllAsRead()
}

const clearAll = async () => {
  try {
    await ElMessageBox.confirm('确定清空所有通知吗？', '提示', { type: 'warning' })
    await notificationStore.clearAll()
  } catch (e) {}
}

onMounted(fetchNotifications)
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;

.r-notification--page {
  padding: 24px;
  min-height: calc(100vh - 60px);
  background: #f5f5f5;
}

.r-notification--container {
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
}

.r-notification--header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
  
  h2 {
    font-size: 20px;
    font-weight: 600;
    color: $text-color;
    margin: 0;
  }
  
  .r-notification--actions {
    display: flex;
    gap: 8px;
  }
}

.r-notification--tabs {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-bottom: 1px solid #eee;
  overflow-x: auto;
  
  span {
    padding: 6px 16px;
    font-size: 14px;
    color: $text-secondary;
    background: #f5f5f5;
    border-radius: 20px;
    cursor: pointer;
    white-space: nowrap;
    
    &:hover {
      color: $primary-color;
    }
    
    &.active {
      background: $primary-color;
      color: $text-color;
    }
  }
}

.r-notification--list {
  min-height: 300px;
}

.r-notification--item {
  display: flex;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: #fafafa;
  }
  
  &.unread {
    background: rgba($primary-color, 0.05);
    
    .r-notification--title {
      font-weight: 600;
    }
  }
  
  .r-notification--avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .r-notification--icon {
      width: 24px;
      height: 24px;
      
      &.r-notification--icon_like {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FEC433'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-notification--icon_comment {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23409EFF'%3E%3Cpath d='M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-notification--icon_reply {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2367C23A'%3E%3Cpath d='M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-notification--icon_follow {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23E6A23C'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-notification--icon_system {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23909399'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }

      &.r-notification--icon_report,
      &.r-notification--icon_report_received,
      &.r-notification--icon_report_submitted,
      &.r-notification--icon_report_processed,
      &.r-notification--icon_developer_app_review {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23F59E0B'%3E%3Cpath d='M12 2 2 6v5c0 5.55 3.84 10.74 10 12 6.16-1.26 10-6.45 10-12V6L12 2zm0 4 6 2.4V11c0 3.7-2.37 7.45-6 8.55C8.37 18.45 6 14.7 6 11V8.4L12 6zm-1 3v5h2V9h-2zm0 6v2h2v-2h-2z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
    }
  }
  
  .r-notification--content {
    flex: 1;
    min-width: 0;
    
    .r-notification--title {
      font-size: 14px;
      color: $text-color;
      margin-bottom: 4px;
      
      .r-notification--sender {
        color: $primary-color;
        font-weight: 500;
      }
    }
    
    .r-notification--text {
      font-size: 13px;
      color: $text-secondary;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .r-notification--time {
      font-size: 12px;
      color: $text-muted;
    }
  }
  
  .r-notification--actions {
    flex-shrink: 0;
  }
}

.r-notification--pagination {
  padding: 20px 24px;
  display: flex;
  justify-content: center;
}
</style>

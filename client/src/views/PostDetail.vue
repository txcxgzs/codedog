<template>
  <div class="r-post--page" v-loading="loading">
    <div class="r-post--container" v-if="post">
      <div class="r-post--main">
        <div class="r-post--header">
          <h1 class="r-post--title">{{ post.title }}</h1>
          <div class="r-post--meta">
            <img :src="post.author?.avatar || defaultAvatar" class="r-post--author_avatar" />
            <span class="r-post--author_name">{{ post.author?.nickname || post.author?.username }}</span>
            <span class="r-post--time">{{ formatTime(post.created_at) }}</span>
            <span class="r-post--views">{{ post.view_count }} 阅读</span>
            <span class="r-post--tag" v-if="post.category">{{ getCategoryName(post.category) }}</span>
          </div>
        </div>
        
        <div class="r-post--content markdown-body" v-html="renderedContent"></div>
        
        <div class="r-post--tags" v-if="post.tags">
          <el-tag v-for="tag in post.tags.split(',')" :key="tag" size="small">{{ tag }}</el-tag>
        </div>
        
        <div class="r-post--actions">
          <el-button :type="liked ? 'primary' : 'default'" @click="likePost">
            <span class="r-post--action_icon r-post--action_icon_like"></span>
            点赞 {{ post.like_count }}
          </el-button>
          <el-button @click="scrollToComment">
            <span class="r-post--action_icon r-post--action_icon_comment"></span>
            评论 {{ post.comment_count }}
          </el-button>
          <el-button @click="showShareDialog = true">
            <span class="r-post--action_icon r-post--action_icon_share"></span>
            分享
          </el-button>
          <el-dropdown @command="handleMoreAction" class="r-post--more">
            <el-button>
              <span class="r-post--action_icon r-post--action_icon_more"></span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="report">举报帖子</el-dropdown-item>
                <el-dropdown-item command="copyLink">复制链接</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        
        <!-- 评论区 -->
        <div class="r-post--comments" ref="commentSection">
          <h3 class="r-post--comments_title">评论 ({{ post.comment_count }})</h3>
          
          <div class="r-post--comment_form" v-if="userStore.isLoggedIn">
            <el-input v-model="commentContent" type="textarea" :rows="3" placeholder="写下你的评论..." />
            <el-button type="primary" :loading="commentLoading" @click="submitComment">发表评论</el-button>
          </div>
          <div class="r-post--login_tip" v-else>
            <router-link to="/login">登录</router-link> 后参与讨论
          </div>
          
          <div class="r-post--comment_list">
            <div v-for="comment in comments" :key="comment.id" class="r-post--comment_item">
              <img :src="comment.user?.avatar || defaultAvatar" class="r-post--comment_avatar" />
              <div class="r-post--comment_body">
                <div class="r-post--comment_header">
                  <span class="r-post--comment_name">{{ comment.user?.nickname || comment.user?.username }}</span>
                  <span class="r-post--comment_time">{{ formatTime(comment.created_at) }}</span>
                </div>
                <p class="r-post--comment_content">{{ comment.content }}</p>
                <div class="r-post--comment_actions">
                  <span @click="likeComment(comment)"><span class="r-post--comment_icon r-post--comment_icon_like"></span>{{ comment.like_count || 0 }}</span>
                  <span @click="replyTo(comment)"><span class="r-post--comment_icon r-post--comment_icon_reply"></span>回复</span>
                  <span v-if="comment.user_id === userStore.user?.id" @click="deleteComment(comment)" class="r-post--comment_delete">删除</span>
                  <span v-else @click="reportComment(comment)" class="r-post--comment_report">举报</span>
                </div>
                
                <!-- 回复列表 -->
                <div class="r-post--replies" v-if="comment.replies && comment.replies.length > 0">
                  <div v-for="reply in comment.replies" :key="reply.id" class="r-post--reply_item">
                    <span class="r-post--reply_name">{{ reply.user?.nickname || reply.user?.username }}</span>
                    <span class="r-post--reply_content">{{ reply.content }}</span>
                    <span class="r-post--reply_time">{{ formatTime(reply.created_at) }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <el-empty v-if="!loading && comments.length === 0" description="暂无评论，快来抢沙发吧~" />
          </div>
        </div>
      </div>
      
      <!-- 侧边栏 -->
      <aside class="r-post--sidebar">
        <div class="r-post--author_card">
          <img :src="post.author?.avatar || defaultAvatar" class="r-post--author_card_avatar" />
          <div class="r-post--author_card_info">
            <h4>{{ post.author?.nickname || post.author?.username }}</h4>
            <p>{{ post.author?.bio || '这个人很懒，什么都没写' }}</p>
          </div>
          <el-button type="primary" size="small" @click="followAuthor" v-if="userStore.user?.id !== post.author?.id">
            {{ following ? '已关注' : '关注' }}
          </el-button>
        </div>
        
        <div class="r-post--related" v-if="relatedPosts.length > 0">
          <h4>相关帖子</h4>
          <router-link v-for="p in relatedPosts" :key="p.id" :to="`/post/${p.id}`" class="r-post--related_item">
            <span class="r-post--related_title">{{ p.title }}</span>
            <span class="r-post--related_count">{{ p.comment_count }} 评论</span>
          </router-link>
        </div>
      </aside>
    </div>
    
    <!-- 分享对话框 -->
    <el-dialog v-model="showShareDialog" title="分享帖子" width="400px">
      <div class="r-post--share_content">
        <div class="r-post--share_qrcode">
          <img :src="qrcodeUrl" v-if="qrcodeUrl" />
          <p>扫码分享</p>
        </div>
        <div class="r-post--share_link">
          <el-input :model-value="shareLink" readonly>
            <template #append>
              <el-button @click="copyShareLink">复制</el-button>
            </template>
          </el-input>
        </div>
        <div class="r-post--share_platforms">
          <span class="r-post--share_label">分享到：</span>
          <el-button circle size="small" @click="shareToWeibo">
            <span class="r-post--share_icon r-post--share_icon_weibo"></span>
          </el-button>
          <el-button circle size="small" @click="shareToQQ">
            <span class="r-post--share_icon r-post--share_icon_qq"></span>
          </el-button>
        </div>
      </div>
    </el-dialog>
    
    <GeetestDialog ref="geetestDialogRef" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { postApi } from '@/api/post'
import { commentApi } from '@/api/comment'
import { reportApi } from '@/api/report'
import { followApi } from '@/api/follow'
import { ElMessage, ElMessageBox } from 'element-plus'
import GeetestDialog from '@/components/GeetestDialog.vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

// 配置 marked
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
  breaks: true,
  gfm: true
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const commentLoading = ref(false)
const post = ref(null)
const comments = ref([])
const relatedPosts = ref([])
const liked = ref(false)
const following = ref(false)
const commentContent = ref('')
const commentSection = ref(null)
const showShareDialog = ref(false)
const qrcodeUrl = ref('')
const geetestDialogRef = ref(null)
const geetestConfig = ref(null)

const renderedContent = computed(() => {
  if (!post.value?.content) return ''
  return DOMPurify.sanitize(marked(post.value.content))
})

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const shareLink = computed(() => {
  if (!post.value) return ''
  return `${window.location.origin}/post/${post.value.id}`
})

const categoryMap = {
  discussion: '讨论',
  question: '问答',
  share: '分享',
  tutorial: '教程',
  news: '公告'
}

const getCategoryName = (category) => categoryMap[category] || category

const formatTime = (time) => {
  if (!time) return ''
  const d = new Date(time)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fetchPost = async () => {
  loading.value = true
  try {
    const res = await postApi.getPost(route.params.id)
    if (res.code === 200) {
      post.value = res.data
      comments.value = res.data.comments || []
      fetchRelatedPosts()
    }
  } catch (e) {
    console.error('获取帖子失败:', e)
    ElMessage.error('帖子不存在或已被删除')
    router.push('/community')
  } finally {
    loading.value = false
  }
}

const fetchRelatedPosts = async () => {
  try {
    const res = await postApi.getPosts({ page: 1, pageSize: 5 })
    if (res.code === 200) {
      relatedPosts.value = (res.data.list || []).filter(p => p.id !== post.value?.id).slice(0, 5)
    }
  } catch (e) {}
}

const likePost = async () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  
  let geetestData = {}
  
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.like) {
    geetestData = await geetestDialogRef.value.show('like')
    if (!geetestData) return
  }
  
  try {
    const res = await postApi.likePost(post.value.id, geetestData)
    if (res.code === 200) {
      liked.value = !liked.value
      post.value.like_count += liked.value ? 1 : -1
    }
  } catch (e) {
    console.error('点赞失败:', e)
  }
}

const followAuthor = async () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  try {
    if (following.value) {
      await followApi.unfollow(post.value.author.id)
      following.value = false
      ElMessage.success('已取消关注')
    } else {
      await followApi.follow(post.value.author.id)
      following.value = true
      ElMessage.success('关注成功')
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const submitComment = async () => {
  if (!commentContent.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
  commentLoading.value = true
  try {
    const res = await commentApi.createComment({
      content: commentContent.value,
      post_id: post.value.id
    })
    if (res.code === 200) {
      comments.value.unshift(res.data)
      post.value.comment_count++
      commentContent.value = ''
      ElMessage.success('评论成功')
    }
  } catch (e) {
    ElMessage.error('评论失败')
  } finally {
    commentLoading.value = false
  }
}

const likeComment = async (comment) => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  
  let geetestData = {}
  
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.like) {
    geetestData = await geetestDialogRef.value.show('like')
    if (!geetestData) return
  }
  
  try {
    const res = await commentApi.likeComment(comment.id, geetestData)
    if (res.code === 200) {
      comment.like_count = (comment.like_count || 0) + 1
    }
  } catch (e) {
    console.error('点赞失败:', e)
  }
}

const replyTo = (comment) => {
  commentContent.value = `@${comment.user?.nickname || comment.user?.username} `
}

const deleteComment = async (comment) => {
  try {
    await ElMessageBox.confirm('确定删除这条评论吗？', '提示', { type: 'warning' })
    const res = await commentApi.deleteComment(comment.id)
    if (res.code === 200) {
      const index = comments.value.findIndex(c => c.id === comment.id)
      if (index > -1) {
        comments.value.splice(index, 1)
        post.value.comment_count = Math.max(0, post.value.comment_count - 1)
      }
      ElMessage.success('删除成功')
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const reportComment = async (comment) => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  
  let geetestData = {}
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.report) {
    geetestData = await geetestDialogRef.value.show('report')
    if (!geetestData) return
  }
  
  ElMessageBox.prompt('请输入举报原因', '举报评论', {
    confirmButtonText: '提交',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '请输入举报原因'
  }).then(async ({ value }) => {
    try {
      const res = await reportApi.create({
        type: 'comment',
        target_id: comment.id,
        reason: value,
        description: `评论内容: ${comment.content}`,
        ...geetestData
      })
      if (res.code === 200) {
        ElMessage.success('举报成功，我们会尽快处理')
      } else {
        ElMessage.error(res.msg || '举报失败')
      }
    } catch (e) {
      ElMessage.error('举报失败')
    }
  }).catch(() => {})
}

const scrollToComment = () => {
  commentSection.value?.scrollIntoView({ behavior: 'smooth' })
}

const handleMoreAction = async (command) => {
  if (command === 'report') {
    if (!userStore.isLoggedIn) {
      ElMessage.warning('请先登录')
      return
    }
    
    let geetestData = {}
    if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.report) {
      geetestData = await geetestDialogRef.value.show('report')
      if (!geetestData) return
    }
    
    ElMessageBox.prompt('请输入举报原因', '举报帖子', {
      confirmButtonText: '提交',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '请输入举报原因'
    }).then(async ({ value }) => {
      try {
        const res = await reportApi.create({
          type: 'post',
          target_id: post.value.id,
          reason: value,
          description: `帖子标题: ${post.value.title}`,
          ...geetestData
        })
        if (res.code === 200) {
          ElMessage.success('举报成功，我们会尽快处理')
        } else {
          ElMessage.error(res.msg || '举报失败')
        }
      } catch (e) {
        ElMessage.error('举报失败')
      }
    }).catch(() => {})
  } else if (command === 'copyLink') {
    copyShareLink()
  }
}

const generateQrcode = async () => {
  try {
    const QRCode = (await import('qrcode')).default
    qrcodeUrl.value = await QRCode.toDataURL(shareLink.value, { width: 150, margin: 2 })
  } catch (e) {
    console.error('生成二维码失败:', e)
  }
}

const copyShareLink = async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value)
    ElMessage.success('链接已复制')
  } catch (e) {
    ElMessage.error('复制失败')
  }
}

const shareToWeibo = () => {
  const url = encodeURIComponent(shareLink.value)
  const title = encodeURIComponent(post.value?.title || '分享帖子')
  window.open(`https://service.weibo.com/share/share.php?url=${url}&title=${title}`, '_blank')
}

const shareToQQ = () => {
  const url = encodeURIComponent(shareLink.value)
  const title = encodeURIComponent(post.value?.title || '分享帖子')
  window.open(`https://connect.qq.com/widget/shareqq/index.html?url=${url}&title=${title}`, '_blank')
}

watch(showShareDialog, (val) => {
  if (val && !qrcodeUrl.value) generateQrcode()
})

watch(() => route.params.id, fetchPost)
const fetchGeetestConfig = async () => {
  try {
    const res = await fetch('/api/geetest/config').then(r => r.json())
    if (res.code === 200) {
      geetestConfig.value = res.data
    }
  } catch (e) {
    console.error('获取验证码配置失败:', e)
  }
}

onMounted(() => {
  fetchPost()
  fetchGeetestConfig()
})
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;
$white: #fff;
$border-color: #eee;

.r-post--page {
  padding: 24px;
  min-height: calc(100vh - 60px);
  background: #f5f5f5;
}

.r-post--container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 24px;
}

.r-post--main {
  flex: 1;
  background: $white;
  border-radius: 12px;
  padding: 32px;
}

.r-post--sidebar {
  width: 300px;
  flex-shrink: 0;
  
  @media (max-width: 900px) {
    display: none;
  }
}

.r-post--header {
  margin-bottom: 24px;
  
  .r-post--title {
    font-size: 24px;
    font-weight: 600;
    color: $text-color;
    margin: 0 0 16px;
  }
  
  .r-post--meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    
    .r-post--author_avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }
    
    .r-post--author_name {
      font-size: 14px;
      font-weight: 500;
      color: $text-color;
    }
    
    .r-post--time, .r-post--views {
      font-size: 13px;
      color: $text-muted;
    }
    
    .r-post--tag {
      font-size: 12px;
      padding: 2px 8px;
      background: rgba($primary-color, 0.2);
      color: darken($primary-color, 20%);
      border-radius: 4px;
    }
  }
}

.r-post--content {
  font-size: 16px;
  line-height: 1.8;
  color: $text-color;
  margin-bottom: 32px;
  word-wrap: break-word;
  
  &.markdown-body {
    :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
      color: #24292e;
    }
    
    :deep(h1) { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
    :deep(h2) { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
    :deep(h3) { font-size: 1.25em; }
    
    :deep(p) { margin-top: 0; margin-bottom: 16px; }
    
    :deep(ul), :deep(ol) {
      padding-left: 2em;
      margin-top: 0;
      margin-bottom: 16px;
    }
    
    :deep(li) { margin-top: .25em; }
    
    :deep(blockquote) {
      padding: 0 1em;
      color: #6a737d;
      border-left: .25em solid #dfe2e5;
      margin: 0 0 16px 0;
    }
    
    :deep(img) {
      max-width: 100%;
      border-radius: 8px;
      display: block;
      margin: 16px auto;
    }
    
    :deep(pre) {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow: auto;
      margin-bottom: 16px;
      
      code {
        padding: 0;
        margin: 0;
        background-color: transparent;
        border: 0;
        word-break: normal;
        white-space: pre;
      }
    }
    
    :deep(code) {
      padding: .2em .4em;
      margin: 0;
      font-size: 85%;
      background-color: rgba(27,31,35,.05);
      border-radius: 3px;
      font-family: SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;
    }

    :deep(table) {
      border-spacing: 0;
      border-collapse: collapse;
      margin-top: 0;
      margin-bottom: 16px;
      width: 100%;
      
      th, td {
        padding: 6px 13px;
        border: 1px solid #dfe2e5;
      }
      
      tr {
        background-color: #fff;
        border-top: 1px solid #c6cbd1;
        
        &:nth-child(2n) {
          background-color: #f6f8fa;
        }
      }
    }
    
    :deep(hr) {
      height: .25em;
      padding: 0;
      margin: 24px 0;
      background-color: #e1e4e8;
      border: 0;
    }
  }
}

.r-post--tags {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  
  .el-tag {
    background: rgba($primary-color, 0.1);
    border-color: rgba($primary-color, 0.3);
    color: darken($primary-color, 30%);
  }
}

.r-post--actions {
  display: flex;
  gap: 12px;
  padding-bottom: 24px;
  border-bottom: 1px solid $border-color;
  margin-bottom: 24px;
  flex-wrap: wrap;
  
  .el-button {
    border-radius: 8px;
  }
  
  .r-post--action_icon {
    width: 14px;
    height: 14px;
    display: inline-block;
    margin-right: 4px;
    
    &.r-post--action_icon_like {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
    
    &.r-post--action_icon_favorite {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
    
    &.r-post--action_icon_comment {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
    
    &.r-post--action_icon_share {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
    
    &.r-post--action_icon_more {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
  }
  
  .r-post--more {
    margin-left: auto;
  }
}

.r-post--comments {
  .r-post--comments_title {
    font-size: 18px;
    font-weight: 600;
    color: $text-color;
    margin: 0 0 20px;
  }
}

.r-post--comment_form {
  margin-bottom: 24px;
  
  .el-textarea {
    margin-bottom: 12px;
  }
  
  .el-button {
    border-radius: 8px;
    background: $primary-color;
    border-color: $primary-color;
    color: $text-color;
  }
}

.r-post--login_tip {
  text-align: center;
  padding: 24px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 24px;
  
  a {
    color: $primary-color;
  }
}

.r-post--comment_item {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid $border-color;
  
  .r-post--comment_avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .r-post--comment_body {
    flex: 1;
  }
  
  .r-post--comment_header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    
    .r-post--comment_name {
      font-size: 14px;
      font-weight: 500;
      color: $text-color;
    }
    
    .r-post--comment_time {
      font-size: 12px;
      color: $text-muted;
    }
  }
  
  .r-post--comment_content {
    font-size: 14px;
    color: $text-secondary;
    margin: 0 0 8px;
    line-height: 1.6;
  }
  
  .r-post--comment_actions {
    display: flex;
    gap: 16px;
    
    span {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: $text-muted;
      cursor: pointer;
      
      &:hover {
        color: $primary-color;
      }
      
      &.r-post--comment_delete:hover {
        color: #f56c6c;
      }
      
      &.r-post--comment_report:hover {
        color: #e6a23c;
      }
    }
    
    .r-post--comment_icon {
      width: 14px;
      height: 14px;
      
      &.r-post--comment_icon_like {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-post--comment_icon_reply {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
    }
  }
}

.r-post--replies {
  margin-top: 12px;
  padding-left: 16px;
  border-left: 2px solid $border-color;
  
  .r-post--reply_item {
    padding: 8px 0;
    font-size: 13px;
    
    .r-post--reply_name {
      color: $primary-color;
      font-weight: 500;
    }
    
    .r-post--reply_content {
      color: $text-secondary;
      margin: 0 8px;
    }
    
    .r-post--reply_time {
      color: $text-muted;
      font-size: 12px;
    }
  }
}

.r-post--author_card {
  background: $white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  
  .r-post--author_card_avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    margin-bottom: 12px;
  }
  
  .r-post--author_card_info {
    margin-bottom: 12px;
    
    h4 {
      font-size: 16px;
      color: $text-color;
      margin: 0 0 4px;
    }
    
    p {
      font-size: 13px;
      color: $text-muted;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
  
  .el-button {
    width: 100%;
    border-radius: 8px;
  }
}

.r-post--related {
  background: $white;
  border-radius: 12px;
  padding: 20px;
  
  h4 {
    font-size: 16px;
    color: $text-color;
    margin: 0 0 16px;
  }
  
  .r-post--related_item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid $border-color;
    text-decoration: none;
    
    &:last-child {
      border-bottom: none;
    }
    
    .r-post--related_title {
      font-size: 14px;
      color: $text-secondary;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      
      &:hover {
        color: $primary-color;
      }
    }
    
    .r-post--related_count {
      font-size: 12px;
      color: $text-muted;
      flex-shrink: 0;
      margin-left: 8px;
    }
  }
}

.r-post--share_content {
  text-align: center;
  
  .r-post--share_qrcode {
    margin-bottom: 20px;
    
    img {
      width: 150px;
      height: 150px;
      border-radius: 8px;
    }
    
    p {
      margin-top: 8px;
      font-size: 14px;
      color: $text-muted;
    }
  }
  
  .r-post--share_link {
    margin-bottom: 16px;
  }
  
  .r-post--share_platforms {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    
    .r-post--share_label {
      font-size: 14px;
      color: $text-muted;
    }
  }
  
  .r-post--share_icon {
    display: inline-block;
    width: 20px;
    height: 20px;
    
    &.r-post--share_icon_weibo {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23E6162D'%3E%3Cpath d='M10.098 20c-4.612 0-8.363-2.222-8.363-4.958 0-1.428.93-3.08 2.527-4.648 2.126-2.09 4.604-3.038 5.528-2.118.406.404.49 1.096.25 1.9-.166.55.26.384.26.384 1.59-.612 3.038-.578 3.576.204.28.408.312.912.098 1.468-.124.322-.01.376.194.332 1.062-.226 1.906-.092 2.33.424.424.642.316 1.524-.282 2.304-1.068 1.428-3.58 2.526-6.892 2.526z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
    
    &.r-post--share_icon_qq {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2312B7F5'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
  }
}
</style>

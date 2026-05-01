<template>
  <div class="r-community--page">
    <div class="r-community--container">
      <div class="r-community--header">
        <h2 class="r-community--title">社区</h2>
        <el-button type="primary" @click="showPostDialog" v-if="userStore.isLoggedIn">
          <span class="r-community--post_icon"></span>
          发布帖子
        </el-button>
      </div>
      
      <div class="r-community--main">
        <!-- 左侧内容 -->
        <div class="r-community--content">
          <div class="r-community--tabs">
            <el-radio-group v-model="activeCategory" @change="fetchPosts">
              <el-radio-button label="">全部</el-radio-button>
              <el-radio-button label="discussion">讨论</el-radio-button>
              <el-radio-button label="question">问答</el-radio-button>
              <el-radio-button label="share">分享</el-radio-button>
              <el-radio-button label="tutorial">教程</el-radio-button>
            </el-radio-group>
          </div>
          
          <div class="r-community--list" v-loading="loading">
            <div v-for="post in posts" :key="post.id" class="r-community--item" @click="$router.push(`/post/${post.id}`)">
              <div class="r-community--item_main">
                <div class="r-community--item_header">
                  <img :src="post.author?.avatar || defaultAvatar" class="r-community--item_avatar" />
                  <div class="r-community--item_author">
                    <span class="r-community--item_name">{{ post.author?.nickname || post.author?.username }}</span>
                    <span class="r-community--item_time">{{ formatTime(post.created_at) }}</span>
                  </div>
                  <el-tag v-if="post.is_top" type="danger" size="small">置顶</el-tag>
                  <el-tag v-if="post.is_essence" type="warning" size="small">精华</el-tag>
                </div>
                <h4 class="r-community--item_title">{{ post.title }}</h4>
                <p class="r-community--item_content">{{ stripMarkdown(post.content) }}...</p>
                <div class="r-community--item_footer">
                  <span><span class="r-community--stat_icon r-community--stat_icon_view"></span>{{ post.view_count }}</span>
                  <span><span class="r-community--stat_icon r-community--stat_icon_like"></span>{{ post.like_count }}</span>
                  <span><span class="r-community--stat_icon r-community--stat_icon_comment"></span>{{ post.comment_count }}</span>
                </div>
              </div>
              <img v-if="post.cover" :src="post.cover" class="r-community--item_cover" />
            </div>
            
            <el-empty v-if="!loading && posts.length === 0" description="暂无帖子" />
          </div>
          
          <div class="r-community--pagination" v-if="total > pageSize">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              layout="prev, pager, next"
              @current-change="fetchPosts"
            />
          </div>
        </div>
        
        <!-- 右侧边栏 -->
        <aside class="r-community--sidebar">
          <div class="r-community--side_card">
            <h4 class="r-community--card_title">社区公告</h4>
            <p>欢迎来到编程狗社区！请遵守社区规范，文明交流。</p>
          </div>
          
          <div class="r-community--side_card">
            <h4 class="r-community--card_title">发帖须知</h4>
            <ul>
              <li>禁止发布违法违规内容</li>
              <li>禁止恶意攻击他人</li>
              <li>鼓励分享原创内容</li>
              <li>提问前请先搜索</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
    
    <!-- 发帖对话框 -->
    <el-dialog v-model="postDialogVisible" title="发布帖子" width="600px">
      <el-form :model="postForm" :rules="postRules" ref="postFormRef" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="postForm.title" placeholder="请输入标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-radio-group v-model="postForm.category">
            <el-radio label="discussion">讨论</el-radio>
            <el-radio label="question">问答</el-radio>
            <el-radio label="share">分享</el-radio>
            <el-radio label="tutorial">教程</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-tabs type="border-card" class="r-community--editor_tabs">
            <el-tab-pane label="编辑">
              <div class="r-community--rich_editor_toolbar">
                <el-button-group>
                  <el-button size="small" @click="insertText('**', '**')" title="加粗"><b>B</b></el-button>
                  <el-button size="small" @click="insertText('*', '*')" title="斜体"><i>I</i></el-button>
                  <el-button size="small" @click="insertText('`', '`')" title="代码块"><code>Code</code></el-button>
                  <el-button size="small" @click="insertText('![图片描述](', ')')" title="插入图片">🖼️ 图片</el-button>
                  <el-button size="small" @click="insertText('<span style=\'color:red\'>', '</span>')" title="标红">🔴 红字</el-button>
                </el-button-group>
              </div>
              <el-input
                v-model="postForm.content"
                type="textarea"
                :rows="10"
                placeholder="写下你的想法吧...支持Markdown和HTML红字"
                maxlength="10000"
                show-word-limit
                ref="postContentRef"
              />
            </el-tab-pane>
            <el-tab-pane label="预览">
              <div class="r-community--preview_box markdown-body" v-html="renderedPostContent"></div>
            </el-tab-pane>
          </el-tabs>
        </el-form-item>
        <el-form-item label="封面" prop="cover">
          <el-input v-model="postForm.cover" placeholder="封面图片URL（可选）" />
        </el-form-item>
        <el-form-item label="标签" prop="tags">
          <el-input v-model="postForm.tags" placeholder="标签，用逗号分隔（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="postDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="postLoading" @click="createPost">发布</el-button>
      </template>
    </el-dialog>
    
    <GeetestDialog ref="geetestDialogRef" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { postApi } from '@/api/post'
import { geetestApi } from '@/api/geetest'
import { ElMessage } from 'element-plus'
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

const userStore = useUserStore()
const loading = ref(false)
const postLoading = ref(false)
const activeCategory = ref('')
const posts = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const postDialogVisible = ref(false)
const postFormRef = ref(null)
const postContentRef = ref(null)
const geetestDialogRef = ref(null)
const geetestConfig = ref(null)

const renderedPostContent = computed(() => {
  if (!postForm.content) return ''
  return DOMPurify.sanitize(marked(postForm.content))
})

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const postForm = reactive({
  title: '',
  content: '',
  category: 'discussion',
  cover: '',
  tags: ''
})

const insertText = (prefix, suffix = '') => {
  const textarea = postContentRef.value?.$el?.querySelector('textarea')
  if (!textarea) {
    postForm.content += prefix + suffix
    return
  }
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = postForm.content.substring(start, end)
  const replacement = prefix + (selectedText || '') + suffix
  
  postForm.content = postForm.content.substring(0, start) + replacement + postForm.content.substring(end)
  
  // 恢复焦点并移动光标
  setTimeout(() => {
    textarea.focus()
    if (selectedText) {
      textarea.selectionStart = start
      textarea.selectionEnd = start + replacement.length
    } else {
      textarea.selectionStart = textarea.selectionEnd = start + prefix.length
    }
  }, 0)
}

const postRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入内容', trigger: 'blur' }]
}

const stripMarkdown = (text) => {
  if (!text) return ''
  return text
    .replace(/<[^>]+>/g, '') // 去掉HTML
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // 去掉粗体
    .replace(/(\*|_)(.*?)\1/g, '$2') // 去掉斜体
    .replace(/`{3,}[\s\S]*?`{3,}/g, '[代码块]') // 去掉多行代码
    .replace(/`(.+?)`/g, '$1') // 去掉行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]') // 去掉图片
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 去掉链接
    .replace(/#+\s+(.*)/g, '$1') // 去掉标题
    .replace(/>\s+(.*)/g, '$1') // 去掉引用
    .substring(0, 150)
}

const formatTime = (time) => {
  if (!time) return ''
  const d = new Date(time)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return `${d.getMonth() + 1}-${d.getDate()}`
}

const fetchPosts = async () => {
  loading.value = true
  try {
    const res = await postApi.getPosts({
      page: currentPage.value,
      pageSize: pageSize.value,
      category: activeCategory.value
    })
    if (res.code === 200) {
      posts.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('获取帖子失败:', e)
  } finally {
    loading.value = false
  }
}

const fetchGeetestConfig = async () => {
  try {
    const res = await geetestApi.getConfig()
    if (res.code === 200) {
      geetestConfig.value = res.data
    }
  } catch (e) {
    console.error('获取极验配置失败:', e)
  }
}

const showPostDialog = () => {
  postForm.title = ''
  postForm.content = ''
  postForm.category = 'discussion'
  postForm.cover = ''
  postForm.tags = ''
  postDialogVisible.value = true
}

const createPost = async () => {
  const valid = await postFormRef.value.validate().catch(() => false)
  if (!valid) return
  
  let geetestData = {}
  
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.publish_post) {
    geetestData = await geetestDialogRef.value.show('publish_post')
    if (!geetestData) {
      postLoading.value = false
      return
    }
  }
  
  postLoading.value = true
  try {
    const res = await postApi.createPost({ ...postForm, ...geetestData })
    if (res.code === 200) {
      ElMessage.success('发布成功')
      postDialogVisible.value = false
      currentPage.value = 1
      fetchPosts()
    } else {
      ElMessage.error(res.msg || '发布失败')
    }
  } catch (e) {
    ElMessage.error('发布失败')
  } finally {
    postLoading.value = false
  }
}

onMounted(() => {
  fetchPosts()
  fetchGeetestConfig()
})
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

.rich-editor-toolbar {
  margin-bottom: 8px;
}

.r-community--page {
  padding: 24px;
  min-height: calc(100vh - 60px);
  background: #f5f5f5;
}

.r-community--container {
  max-width: 1200px;
  margin: 0 auto;
}

.r-community--header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  .r-community--title {
    font-size: 24px;
    font-weight: 600;
    color: $text-color;
    margin: 0;
  }
  
  .el-button {
    background: $primary-color;
    border-color: $primary-color;
    color: $text-color;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    
    &:hover {
      background: $primary-hover;
      border-color: $primary-hover;
    }
  }
  
  .r-community--post_icon {
    width: 14px;
    height: 14px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23333'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'/%3E%3C/svg%3E") no-repeat center;
    background-size: contain;
  }
}

.r-community--main {
  display: flex;
  gap: 20px;
}

.r-community--content {
  flex: 1;
  min-width: 0;
}

.r-community--tabs {
  background: $white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  
  :deep(.el-radio-button__inner) {
    border-radius: 16px;
    border: none;
    padding: 8px 20px;
  }
  
  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background: $primary-color;
    color: $text-color;
    box-shadow: none;
  }
}

.r-community--list {
  background: $white;
  border-radius: 12px;
}

.r-community--item {
  display: flex;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid $border-color;
  cursor: pointer;
  transition: background 0.2s;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: #fafafa;
  }
  
  .r-community--item_main {
    flex: 1;
    min-width: 0;
  }
  
  .r-community--item_header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    
    .r-community--item_avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }
    
    .r-community--item_author {
      flex: 1;
      display: flex;
      flex-direction: column;
      
      .r-community--item_name {
        font-size: 14px;
        font-weight: 500;
        color: $text-color;
      }
      
      .r-community--item_time {
        font-size: 12px;
        color: $text-muted;
      }
    }
  }
  
  .r-community--item_title {
    font-size: 16px;
    font-weight: 600;
    color: $text-color;
    margin: 0 0 8px;
  }
  
  .r-community--item_content {
    font-size: 14px;
    color: $text-secondary;
    margin: 0 0 12px;
    line-height: 1.6;
  }
  
  .r-community--item_footer {
    display: flex;
    gap: 20px;
    
    span {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: $text-muted;
    }
    
    .r-community--stat_icon {
      width: 14px;
      height: 14px;
      
      &.r-community--stat_icon_view {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-community--stat_icon_like {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-community--stat_icon_comment {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
    }
  }
  
  .r-community--item_cover {
    width: 120px;
    height: 80px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
  }
}

.r-community--sidebar {
  width: 280px;
  flex-shrink: 0;
  
  @media (max-width: 992px) {
    display: none;
  }
}

.r-community--side_card {
  background: $white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  
  .r-community--card_title {
    font-size: 15px;
    font-weight: 600;
    color: $text-color;
    margin: 0 0 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid $border-color;
  }
  
  p {
    font-size: 13px;
    color: $text-secondary;
    margin: 0;
    line-height: 1.6;
  }
  
  ul {
    margin: 0;
    padding-left: 16px;
    
    li {
      font-size: 13px;
      color: $text-secondary;
      line-height: 2;
    }
  }
}

.r-community--pagination {
  display: flex;
  justify-content: center;
  padding: 20px;
  background: $white;
  border-radius: 0 0 12px 12px;
}
</style>

<template>
  <div class="r-work--page" v-loading="loading">
    <div class="r-work--container" v-if="work">
      <!-- 作品预览区 -->
      <div class="r-work--preview_section">
        <div class="r-work--preview_wrapper">
          <iframe 
            v-if="playerUrl"
            :src="playerUrl"
            class="r-work--player"
            allowfullscreen
          ></iframe>
          <div v-else class="r-work--no_preview">
            <span class="r-work--no_preview_icon"></span>
            <p>暂无预览</p>
          </div>
        </div>
      </div>
      
      <!-- 作品信息区 -->
      <div class="r-work--info_section">
        <div class="r-work--main_info">
          <h1 class="r-work--title">{{ work.name }}</h1>
          <div class="r-work--desc markdown-body" v-html="renderedDescription"></div>
          
          <div class="r-work--meta">
            <div class="r-work--author" @click="goToAuthor">
              <img :src="work.author?.avatar || defaultAvatar" class="r-work--author_avatar" />
              <div class="r-work--author_info">
                <span class="r-work--author_name">{{ work.author?.nickname || work.author?.username || work.codemao_author_name }}</span>
                <span class="r-work--publish_time">发布于 {{ formatTime(work.created_at) }}</span>
              </div>
            </div>
            
            <div class="r-work--stats">
              <span class="r-work--stat_item">
                <span class="r-work--stat_icon r-work--stat_icon_view"></span>
                {{ work.view_times || 0 }}
              </span>
              <span class="r-work--stat_item">
                <span class="r-work--stat_icon r-work--stat_icon_like"></span>
                {{ work.praise_times || 0 }}
              </span>
              <span class="r-work--stat_item">
                <span class="r-work--stat_icon r-work--stat_icon_comment"></span>
                {{ work.comment_count || 0 }}
              </span>
            </div>
          </div>
          
          <div class="r-work--tags" v-if="work.type">
            <el-tag class="r-work--tag" effect="dark">{{ getTypeName(work.type) }}</el-tag>
          </div>
          
          <div class="r-work--actions">
            <el-button 
              :type="work.liked ? 'danger' : 'primary'" 
              class="r-work--action_btn r-work--action_btn_like" 
              @click="likeWork"
              :style="{ width: 'auto' }"
            >
              <el-icon class="el-icon--left" v-if="!work.liked"><Pointer /></el-icon>
              <el-icon class="el-icon--left" v-else><StarFilled /></el-icon>
              {{ work.liked ? '已点赞' : '点赞' }}
            </el-button>
            <el-button 
              :type="isFavorited ? 'warning' : 'default'" 
              class="r-work--action_btn" 
              @click="toggleFavorite"
              :loading="favoriteLoading"
            >
              <el-icon class="el-icon--left" v-if="!isFavorited"><Star /></el-icon>
              <el-icon class="el-icon--left" v-else><StarFilled /></el-icon>
              {{ isFavorited ? '已收藏' : '收藏' }}
            </el-button>
            <el-button class="r-work--action_btn" @click="showShareDialog">
              <el-icon class="el-icon--left"><Share /></el-icon>
              分享
            </el-button>
            <el-dropdown trigger="click" @command="handleMoreAction">
              <el-button class="r-work--action_btn">
                <el-icon class="el-icon--left"><More /></el-icon>
                更多
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit" v-if="work.user_id === userStore.user?.id"><el-icon><Edit /></el-icon>编辑作品</el-dropdown-item>
                  <el-dropdown-item command="report"><el-icon><Warning /></el-icon>举报作品</el-dropdown-item>
                  <el-dropdown-item command="copyLink"><el-icon><CopyDocument /></el-icon>复制链接</el-dropdown-item>
                  <el-dropdown-item command="openOriginal" v-if="work.codemao_work_id"><el-icon><Link /></el-icon>查看原作品</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          
          <!-- 评论区 -->
          <div class="r-work--comments_section">
            <h3 class="r-work--comments_title">
              评论 <span class="r-work--comments_count">({{ work.comment_count || 0 }})</span>
            </h3>
            
            <!-- 发表评论 -->
            <div class="r-work--comment_form" v-if="userStore.isLoggedIn">
              <div v-if="replyingTo" class="r-work--replying_to">
                回复 @{{ replyingTo.user?.nickname || replyingTo.user?.username }}
                <span class="r-work--cancel_reply" @click="cancelReply">取消</span>
              </div>
              <el-input
                v-model="commentContent"
                type="textarea"
                :rows="3"
                :placeholder="replyingTo ? '写下你的回复...' : '写下你的评论...'"
                maxlength="500"
                show-word-limit
              />
              <el-button type="primary" :loading="submitting" @click="submitComment">
                {{ replyingTo ? '回复' : '发表评论' }}
              </el-button>
            </div>
            <div class="r-work--login_tip" v-else>
              <router-link to="/login">登录</router-link> 后参与讨论
            </div>
            
            <!-- 评论列表 -->
            <div class="r-work--comment_list" v-loading="loadingComments">
              <div v-for="comment in comments" :key="comment.id" class="r-work--comment_item">
                <img :src="comment.user?.avatar || defaultAvatar" class="r-work--comment_avatar" @click="goUser(comment.user)" style="cursor: pointer;" />
                <div class="r-work--comment_body">
                  <div class="r-work--comment_header">
                    <span class="r-work--comment_name" @click="goUser(comment.user)" style="cursor: pointer;">{{ comment.user?.nickname || comment.user?.username }}</span>
                    <span class="r-work--comment_time">{{ formatTime(comment.created_at) }}</span>
                  </div>
                  <p class="r-work--comment_content">{{ comment.content }}</p>
                  <div class="r-work--comment_actions">
                    <span @click="likeComment(comment)">
                      <span class="r-work--comment_icon r-work--comment_icon_like"></span>
                      {{ comment.like_count || 0 }}
                    </span>
                    <span @click="replyTo(comment)">
                      <span class="r-work--comment_icon r-work--comment_icon_reply"></span>
                      回复
                    </span>
                    <span v-if="comment.user_id === userStore.user?.id" @click="deleteComment(comment)" class="r-work--comment_delete">
                      删除
                    </span>
                    <span v-else @click="reportComment(comment)" class="r-work--comment_report">
                      举报
                    </span>
                  </div>
                  
                  <!-- 回复列表 -->
                  <div class="r-work--replies" v-if="comment.replies && comment.replies.length > 0">
                    <template v-for="(reply, index) in getVisibleReplies(comment)" :key="reply.id">
                      <div class="r-work--reply_item">
                        <img :src="reply.user?.avatar || defaultAvatar" class="r-work--reply_avatar" @click="goUser(reply.user)" style="cursor: pointer;" />
                        <div class="r-work--reply_body">
                          <div class="r-work--reply_header">
                            <span class="r-work--reply_name" @click="goUser(reply.user)" style="cursor: pointer;">{{ reply.user?.nickname || reply.user?.username }}</span>
                            <span class="r-work--reply_time">{{ formatTime(reply.created_at) }}</span>
                          </div>
                          <p class="r-work--reply_content">
                            <span v-if="reply.reply_to_user_id" class="r-work--reply_to" @click="goUserById(reply.reply_to_user_id)" style="cursor: pointer;">
                              回复 @{{ getReplyToName(reply) }}：
                            </span>
                            {{ reply.content }}
                          </p>
                          <div class="r-work--reply_actions">
                            <span @click="likeComment(reply)">
                              <span class="r-work--comment_icon r-work--comment_icon_like"></span>
                              {{ reply.like_count || 0 }}
                            </span>
                            <span @click="replyTo(reply)">
                              <span class="r-work--comment_icon r-work--comment_icon_reply"></span>
                              回复
                            </span>
                            <span v-if="reply.user_id === userStore.user?.id" @click="deleteComment(reply)" class="r-work--comment_delete">
                              删除
                            </span>
                            <span v-else @click="reportComment(reply)" class="r-work--comment_report">
                              举报
                            </span>
                          </div>
                        </div>
                      </div>
                    </template>
                    <div class="r-work--reply_more" v-if="comment.replies.length > 3">
                      <span v-if="!expandedComments.has(comment.id)" @click="expandReplies(comment.id)">
                                展开更多回复 ({{ comment.replies.length - 3 }}条)
                              </span>
                              <span v-else @click="collapseReplies(comment.id)">
                                收起回复
                              </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <el-empty v-if="!loadingComments && comments.length === 0" description="暂无评论，快来抢沙发吧~" />
            </div>
          </div>
        </div>
        
        <!-- 侧边栏 -->
        <aside class="r-work--sidebar">
          <div class="r-work--side_card">
            <h4 class="r-work--card_title">作品信息</h4>
            <ul class="r-work--info_list">
              <li>
                <span class="r-work--info_label">作品ID</span>
                <span class="r-work--info_value">{{ work.codemao_work_id }}</span>
              </li>
              <li>
                <span class="r-work--info_label">作品类型</span>
                <span class="r-work--info_value">{{ getTypeName(work.type) }}</span>
              </li>
              <li>
                <span class="r-work--info_label">来源</span>
                <span class="r-work--info_value">编程猫</span>
              </li>
            </ul>
          </div>
          
          <div class="r-work--side_card">
            <h4 class="r-work--card_title">相关推荐</h4>
            <div class="r-work--related_list" v-loading="loadingRelated">
              <a 
                v-for="item in relatedWorks" 
                :key="item.id"
                class="r-work--related_item"
                @click="$router.push(`/work/${item.codemao_work_id}`)"
              >
                <div class="r-work--related_cover" :style="{ backgroundImage: `url(${item.preview})` }"></div>
                <div class="r-work--related_info">
                  <p class="r-work--related_title">{{ item.name }}</p>
                  <p class="r-work--related_author">{{ item.author?.nickname }}</p>
                </div>
              </a>
              <el-empty v-if="!loadingRelated && relatedWorks.length === 0" description="暂无推荐" :image-size="60" />
            </div>
          </div>
        </aside>
      </div>
    </div>
    
    <el-empty v-else-if="!loading" description="作品不存在" />
    
    <!-- 分享对话框 -->
    <el-dialog v-model="shareDialogVisible" title="分享作品" width="400px">
      <div class="r-work--share_content">
        <div class="r-work--share_qrcode">
          <img :src="qrcodeUrl" alt="二维码" v-if="qrcodeUrl" />
          <p>扫码查看作品</p>
        </div>
        <div class="r-work--share_link">
          <el-input v-model="shareLink" readonly>
            <template #append>
              <el-button @click="copyShareLink">复制</el-button>
            </template>
          </el-input>
        </div>
        <div class="r-work--share_platforms">
          <span class="r-work--share_label">分享到：</span>
          <el-button circle size="small" @click="shareToWeibo" title="微博">
            <span class="r-work--share_icon r-work--share_icon_weibo"></span>
          </el-button>
          <el-button circle size="small" @click="shareToQQ" title="QQ">
            <span class="r-work--share_icon r-work--share_icon_qq"></span>
          </el-button>
        </div>
      </div>
    </el-dialog>
    
    <!-- 举报对话框 -->
    <el-dialog v-model="reportDialogVisible" title="举报作品" width="450px">
      <el-form :model="reportForm" label-width="80px">
        <el-form-item label="举报原因">
          <el-select v-model="reportForm.reason" placeholder="请选择举报原因" style="width: 100%">
            <el-option label="内容违规" value="内容违规" />
            <el-option label="侵权内容" value="侵权内容" />
            <el-option label="垃圾广告" value="垃圾广告" />
            <el-option label="恶意刷屏" value="恶意刷屏" />
            <el-option label="其他原因" value="其他原因" />
          </el-select>
        </el-form-item>
        <el-form-item label="详细描述">
          <el-input v-model="reportForm.description" type="textarea" :rows="4" placeholder="请详细描述举报原因（选填）" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReport" :loading="reportSubmitting">提交举报</el-button>
      </template>
    </el-dialog>
    
    <!-- 编辑作品对话框 -->
    <el-dialog v-model="editWorkVisible" title="编辑作品信息" width="500px">
      <el-form :model="editWorkForm" label-width="80px">
        <el-form-item label="作品名称">
          <el-input v-model="editWorkForm.name" placeholder="请输入作品名称" />
        </el-form-item>
        <el-form-item label="作品描述">
          <el-input v-model="editWorkForm.description" type="textarea" :rows="4" placeholder="请输入作品描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editWorkVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEditWork" :loading="editWorkSubmitting">保存</el-button>
      </template>
    </el-dialog>
    
    <!-- 验证码弹窗 -->
    <GeetestDialog ref="geetestDialogRef" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { workApi } from '@/api/work'
import { commentApi } from '@/api/comment'
import GeetestDialog from '@/components/GeetestDialog.vue'
import { favoriteApi } from '@/api/favorite'
import { reportApi } from '@/api/report'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Pointer, Star, StarFilled, Share, More, Warning, CopyDocument, Link, Edit } from '@element-plus/icons-vue'
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
const loading = ref(true)

const renderedDescription = computed(() => {
  if (!work.value?.description) return '暂无描述'
  return DOMPurify.sanitize(marked(work.value.description))
})
const loadingRelated = ref(false)
const loadingComments = ref(false)
const submitting = ref(false)
const favoriteLoading = ref(false)
const isFavorited = ref(false)
const work = ref(null)
const playerUrl = computed(() => {
  if (!work.value) return null
  const workId = work.value.codemao_work_id
  if (!workId) return null
  
  const type = (work.value.type || '').toUpperCase()
  console.log('type:', type, 'workId:', workId)
  
  // 核心播放器逻辑映射 (基于 type 字段)
  const playerMap = {
    'KITTEN': `https://player.codemao.cn/new/${workId}`,
    'NEMO': `https://nemo.codemao.cn/w/${workId}`,
    'WOOD': `https://python.codemao.cn/player/${workId}`,
    'PYTHON': `https://python.codemao.cn/player/${workId}`,
    'COCO': `https://coco.codemao.cn/player/${workId}`,
    'CODE_BLOCK': `https://block.codemao.cn/player/${workId}`,
    'BOX': `https://box.codemao.cn/w/${workId}`,
    'BOX2': `https://box.codemao.cn/w/${workId}`
  }
  
  if (playerMap[type]) {
    return playerMap[type]
  }
  
  // 如果有原始播放地址则优先使用
  if (work.value.work_url && work.value.work_url.startsWith('http')) {
    return work.value.work_url
  }
  
  // 默认兜底使用 K4 播放器
  return `https://player.codemao.cn/new/${workId}`
})
const relatedWorks = ref([])
const comments = ref([])
const commentContent = ref('')
const replyingTo = ref(null)
const replyingComment = ref(null)
const expandedComments = ref(new Set())

const shareDialogVisible = ref(false)
const reportDialogVisible = ref(false)
const reportSubmitting = ref(false)
const reportForm = ref({ reason: '', description: '' })
const qrcodeUrl = ref('')

const editWorkVisible = ref(false)
const editWorkSubmitting = ref(false)
const editWorkForm = ref({ name: '', description: '' })

const shareLink = computed(() => {
  if (!work.value) return ''
  return `${window.location.origin}/work/${work.value.codemao_work_id}`
})

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0ZFQzQzMyIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPuahijwvdGV4dD48L3N2Zz4='

const formatTime = (time) => {
  if (!time) return '未知'
  const d = new Date(time)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getTypeName = (workType) => {
  if (!workType) return '未分类'
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

const fetchWork = async () => {
  const codemaoId = route.params.codemaoId
  if (!codemaoId) return
  
  loading.value = true
  try {
    const res = await workApi.getDetail(codemaoId)
    if (res.code === 200) {
      work.value = res.data
      fetchRelatedWorks()
      fetchComments()
      checkFavorite()
    }
  } catch (error) {
    console.error('获取作品失败:', error)
  } finally {
    loading.value = false
  }
}

const goUser = (user) => {
  if (user?.codemao_user_id) {
    router.push(`/user/${user.codemao_user_id}`)
  } else if (user?.id) {
    router.push(`/user/${user.id}`)
  }
}

const goUserById = (userId) => {
  if (userId) {
    router.push(`/user/${userId}`)
  }
}

const fetchRelatedWorks = async () => {
  loadingRelated.value = true
  try {
    const res = await workApi.getList({ page: 1, pageSize: 5 })
    if (res.code === 200) {
      relatedWorks.value = res.data.list.filter(w => w.codemao_work_id !== work.value?.codemao_work_id).slice(0, 4)
    }
  } catch (error) {
    console.error('获取推荐失败:', error)
  } finally {
    loadingRelated.value = false
  }
}

const fetchComments = async () => {
  if (!work.value?.id) {
    comments.value = []
    return
  }
  loadingComments.value = true
  try {
    const res = await commentApi.getWorkComments(work.value.id)
    if (res.code === 200) {
      comments.value = res.data.list || []
    }
  } catch (error) {
    console.error('获取评论失败:', error)
  } finally {
    loadingComments.value = false
  }
}

const checkFavorite = async () => {
  if (!userStore.isLoggedIn) return
  if (!work.value?.id) {
    isFavorited.value = false
    return
  }
  try {
    const res = await favoriteApi.check(work.value.id)
    if (res.code === 200) {
      isFavorited.value = res.data.isFavorited
    }
  } catch (error) {
    console.error('检查收藏失败:', error)
  }
}

const geetestDialogRef = ref(null)
const geetestConfig = ref(null)

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

const likeWork = async () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  
  let geetestData = {}
  
  // 检查是否需要验证码
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.like) {
    geetestData = await geetestDialogRef.value.show('like')
    if (!geetestData) return
  }
  
  try {
    const res = await workApi.like(work.value.codemao_work_id, geetestData)
    if (res.code === 200) {
      work.value.praise_times = res.data.praise_times
      work.value.liked = res.data.liked
      ElMessage.success(res.msg)
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const toggleFavorite = async () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  
  favoriteLoading.value = true
  try {
    if (isFavorited.value) {
      const res = await favoriteApi.remove(work.value.id)
      if (res.code === 200) {
        isFavorited.value = false
        work.value.collection_times = Math.max(0, (work.value.collection_times || 0) - 1)
        ElMessage.success('已取消收藏')
      }
    } else {
      const res = await favoriteApi.add(work.value.id)
      if (res.code === 200) {
        isFavorited.value = true
        work.value.collection_times = (work.value.collection_times || 0) + 1
        ElMessage.success('收藏成功')
      }
    }
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    favoriteLoading.value = false
  }
}

const goToAuthor = () => {
  if (work.value?.author?.codemao_user_id) {
    router.push(`/user/${work.value.author.codemao_user_id}`)
  }
}

const submitComment = async () => {
  if (!commentContent.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
  
  let geetestData = {}
  
  // 检查是否需要验证码
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.comment) {
    geetestData = await geetestDialogRef.value.show('comment')
    if (!geetestData) return
  }
  
  submitting.value = true
  try {
    const res = await commentApi.createComment({
      content: commentContent.value,
      work_id: work.value.id,
      parent_id: replyingTo.value?.id || null,
      reply_to_user_id: replyingTo.value?.user?.id || null,
      ...geetestData
    })
    if (res.code === 200) {
      if (replyingTo.value) {
        if (replyingTo.value.parent_id) {
          const parentComment = comments.value.find(c => c.id === replyingTo.value.parent_id)
          if (parentComment && parentComment.replies) {
            parentComment.replies.push(res.data)
          }
        } else {
          const parentComment = comments.value.find(c => c.id === replyingTo.value.id)
          if (parentComment && parentComment.replies) {
            parentComment.replies.push(res.data)
          }
        }
      } else {
        comments.value.unshift(res.data)
      }
      work.value.comment_count = (work.value.comment_count || 0) + 1
      commentContent.value = ''
      cancelReply()
      ElMessage.success('评论成功')
    } else {
      ElMessage.error(res.msg || '评论失败')
    }
  } catch (error) {
    ElMessage.error('评论失败')
  } finally {
    submitting.value = false
  }
}

const cancelReply = () => {
  replyingTo.value = null
  replyingComment.value = null
  commentContent.value = ''
}

const getReplyToName = (reply) => {
  if (!reply.reply_to_user_id) return ''
  const allComments = [...comments.value]
  comments.value.forEach(c => {
    if (c.replies) allComments.push(...c.replies)
  })
  const targetComment = allComments.find(c => c.user_id === reply.reply_to_user_id)
  return targetComment?.user?.nickname || targetComment?.user?.username || ''
}

const getVisibleReplies = (comment) => {
  if (expandedComments.value.has(comment.id)) {
    return comment.replies
  }
  return comment.replies.slice(0, 3)
}

const expandReplies = (commentId) => {
  expandedComments.value.add(commentId)
}

const collapseReplies = (commentId) => {
  expandedComments.value.delete(commentId)
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
  } catch (error) {
    console.error('点赞失败:', error)
  }
}

const replyTo = (comment) => {
  replyingTo.value = comment
  replyingComment.value = comment
  commentContent.value = ''
  document.querySelector('.r-work--comment_form textarea')?.focus()
}

const deleteComment = async (comment) => {
  try {
    await ElMessageBox.confirm('确定删除这条评论吗？', '提示', { type: 'warning' })
    const res = await commentApi.deleteComment(comment.id)
    if (res.code === 200) {
      const index = comments.value.findIndex(c => c.id === comment.id)
      if (index > -1) {
        comments.value.splice(index, 1)
        work.value.comment_count = Math.max(0, (work.value.comment_count || 0) - 1)
      }
      ElMessage.success('删除成功')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const showShareDialog = () => {
  shareDialogVisible.value = true
  generateQrcode()
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
  const title = encodeURIComponent(work.value?.name || '分享作品')
  window.open(`https://service.weibo.com/share/share.php?url=${url}&title=${title}`, '_blank')
}

const shareToQQ = () => {
  const url = encodeURIComponent(shareLink.value)
  const title = encodeURIComponent(work.value?.name || '分享作品')
  const desc = encodeURIComponent(work.value?.description || '')
  window.open(`https://connect.qq.com/widget/shareqq/index.html?url=${url}&title=${title}&desc=${desc}`, '_blank')
}

const handleMoreAction = (command) => {
  if (command === 'report') {
    if (!userStore.isLoggedIn) {
      ElMessage.warning('请先登录')
      return
    }
    reportForm.value = { reason: '', description: '' }
    reportDialogVisible.value = true
  } else if (command === 'edit') {
    editWorkForm.value = { 
      name: work.value.name, 
      description: work.value.description || '' 
    }
    editWorkVisible.value = true
  } else if (command === 'copyLink') {
    copyShareLink()
  } else if (command === 'openOriginal') {
    window.open(`https://creation.codemao.cn/${work.value.codemao_work_id}`, '_blank')
  }
}

const submitEditWork = async () => {
  if (!editWorkForm.value.name) {
    ElMessage.warning('请输入作品名称')
    return
  }
  
  editWorkSubmitting.value = true
  try {
    const res = await workApi.update(work.value.codemao_work_id, {
      name: editWorkForm.value.name,
      description: editWorkForm.value.description
    })
    if (res.code === 200) {
      ElMessage.success('保存成功')
      work.value.name = editWorkForm.value.name
      work.value.description = editWorkForm.value.description
      editWorkVisible.value = false
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    editWorkSubmitting.value = false
  }
}

const submitReport = async () => {
  if (!reportForm.value.reason) {
    ElMessage.warning('请选择举报原因')
    return
  }
  
  let geetestData = {}
  
  // 检查是否需要验证码
  if (geetestConfig.value?.enabled && geetestConfig.value?.scenes?.report) {
    geetestData = await geetestDialogRef.value.show('report')
    if (!geetestData) return
  }
  
  reportSubmitting.value = true
  try {
    const res = await reportApi.create({
      type: 'work',
      target_id: work.value.id,
      reason: reportForm.value.reason,
      description: reportForm.value.description,
      ...geetestData
    })
    if (res.code === 200) {
      ElMessage.success('举报成功，我们会尽快处理')
      reportDialogVisible.value = false
    } else {
      ElMessage.error(res.msg || '举报失败')
    }
  } catch (e) {
    ElMessage.error('举报失败')
  } finally {
    reportSubmitting.value = false
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
        description: `评论内容: ${comment.content}`
      }, geetestData)
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

watch(() => route.params.codemaoId, fetchWork)
onMounted(() => {
  fetchWork()
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

.r-work--page {
  min-height: calc(100vh - 60px);
  padding: 24px;
  background: #f5f5f5;
}

.r-work--container {
  max-width: 1200px;
  margin: 0 auto;
}

.r-work--preview_section {
  background: $white;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
  
  .r-work--preview_wrapper {
    max-width: 900px;
    margin: 0 auto;
    aspect-ratio: 16 / 9;
    
    .r-work--player {
      width: 100%;
      height: 100%;
      border: none;
    }
    
    .r-work--no_preview {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f0f0f0;
      color: $text-muted;
      
      .r-work--no_preview_icon {
        width: 64px;
        height: 64px;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
        margin-bottom: 12px;
      }
    }
  }
}

.r-work--info_section {
  display: flex;
  gap: 20px;
  
  @media (max-width: 992px) {
    flex-direction: column;
  }
}

.r-work--main_info {
  flex: 1;
  background: $white;
  border-radius: 12px;
  padding: 24px;
  
  .r-work--title {
    font-size: 24px;
    font-weight: 600;
    color: $text-color;
    margin: 0 0 12px;
  }
  
  .r-work--desc {
    font-size: 15px;
    color: $text-secondary;
    line-height: 1.8;
    margin: 0 0 20px;
  }
  
  .r-work--meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 20px;
    border-bottom: 1px solid $border-color;
    margin-bottom: 20px;
    
    @media (max-width: 576px) {
      flex-direction: column;
      gap: 16px;
    }
  }
  
  .r-work--author {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    
    &:hover .r-work--author_name {
      color: $primary-color;
    }
    
    .r-work--author_avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
    }
    
    .r-work--author_info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      
      .r-work--author_name {
        font-size: 15px;
        font-weight: 500;
        color: $text-color;
      }
      
      .r-work--publish_time {
        font-size: 13px;
        color: $text-muted;
      }
    }
  }
  
  .r-work--stats {
    display: flex;
    gap: 24px;
    
    .r-work--stat_item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: $text-secondary;
    }
    
    .r-work--stat_icon {
      width: 18px;
      height: 18px;
      
      &.r-work--stat_icon_view {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-work--stat_icon_like {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-work--stat_icon_comment {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
    }
  }
  
  .r-work--tags {
    margin-bottom: 20px;
    
    .r-work--tag {
      background: $primary-light;
      color: $primary-color;
      border: none;
      border-radius: 16px;
    }
  }
  
  .r-work--actions {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    
    .r-work--action_btn {
      border-radius: 8px;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 8px;
      
      &.r-work--action_btn_like {
        background: $primary-color;
        border-color: $primary-color;
        color: $text-color;
        
        &:hover {
          background: $primary-hover;
          border-color: $primary-hover;
        }
      }
    }
  }
}

// 评论区样式
.r-work--comments_section {
  border-top: 1px solid $border-color;
  padding-top: 24px;
  
  .r-work--comments_title {
    font-size: 18px;
    font-weight: 600;
    color: $text-color;
    margin: 0 0 20px;
    
    .r-work--comments_count {
      font-size: 14px;
      color: $text-muted;
      font-weight: normal;
    }
  }
}

.r-work--comment_form {
  margin-bottom: 24px;
  
  .r-work--replying_to {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: $primary-light;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 13px;
    color: $text-secondary;
    
    .r-work--cancel_reply {
      color: $primary-color;
      cursor: pointer;
      font-weight: 500;
      
      &:hover {
        text-decoration: underline;
      }
    }
  }
  
  .el-textarea {
    margin-bottom: 12px;
  }
  
  .el-button {
    border-radius: 8px;
    background: $primary-color;
    border-color: $primary-color;
    color: $text-color;
    
    &:hover {
      background: $primary-hover;
      border-color: $primary-hover;
    }
  }
}

.r-work--login_tip {
  text-align: center;
  padding: 24px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 24px;
  
  a {
    color: $primary-color;
    font-weight: 500;
  }
}

.r-work--comment_list {
  min-height: 100px;
}

.r-work--comment_item {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid $border-color;
  
  .r-work--comment_avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .r-work--comment_body {
    flex: 1;
  }
  
  .r-work--comment_header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    
    .r-work--comment_name {
      font-size: 14px;
      font-weight: 500;
      color: $text-color;
    }
    
    .r-work--comment_time {
      font-size: 12px;
      color: $text-muted;
    }
  }
  
  .r-work--comment_content {
    font-size: 14px;
    color: $text-secondary;
    margin: 0 0 8px;
    line-height: 1.6;
  }
  
  .r-work--comment_actions {
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
      
      &.r-work--comment_delete:hover {
        color: #f56c6c;
      }
      
      &.r-work--comment_report:hover {
        color: #e6a23c;
      }
    }
    
    .r-work--comment_icon {
      width: 14px;
      height: 14px;
      
      &.r-work--comment_icon_like {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
      
      &.r-work--comment_icon_reply {
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z'/%3E%3C/svg%3E") no-repeat center;
        background-size: contain;
      }
    }
  }
}

.r-work--replies {
  margin-top: 12px;
  padding-left: 16px;
  border-left: 2px solid $border-color;
  
  .r-work--reply_item {
    display: flex;
    gap: 10px;
    padding: 10px 0;
    font-size: 13px;
    
    .r-work--reply_avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .r-work--reply_body {
      flex: 1;
    }
    
    .r-work--reply_header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      
      .r-work--reply_name {
        color: $primary-color;
        font-weight: 500;
        font-size: 13px;
      }
      
      .r-work--reply_time {
        color: $text-muted;
        font-size: 12px;
      }
    }
    
    .r-work--reply_content {
      color: $text-secondary;
      margin: 0 0 6px;
      line-height: 1.5;
      font-size: 13px;
      
      .r-work--reply_to {
        color: $primary-color;
        font-weight: 500;
      }
    }
    
    .r-work--reply_actions {
      display: flex;
      gap: 12px;
      
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
      }
    }
  }
  
  .r-work--reply_more {
    padding: 8px 0;
    text-align: center;
    
    span {
      color: $primary-color;
      font-size: 13px;
      cursor: pointer;
      
      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.r-work--sidebar {
  width: 300px;
  flex-shrink: 0;
  
  @media (max-width: 992px) {
    width: 100%;
  }
}

.r-work--side_card {
  background: $white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  
  .r-work--card_title {
    font-size: 16px;
    font-weight: 600;
    color: $text-color;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid $border-color;
  }
}

.r-work--info_list {
  list-style: none;
  padding: 0;
  margin: 0;
  
  li {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    
    .r-work--info_label {
      color: $text-muted;
    }
    
    .r-work--info_value {
      color: $text-color;
    }
  }
}

.r-work--related_list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.r-work--related_item {
  display: flex;
  gap: 12px;
  cursor: pointer;
  text-decoration: none;
  
  &:hover .r-work--related_title {
    color: $primary-color;
  }
  
  .r-work--related_cover {
    width: 80px;
    height: 50px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    flex-shrink: 0;
  }
  
  .r-work--related_info {
    flex: 1;
    min-width: 0;
    
    .r-work--related_title {
      font-size: 14px;
      color: $text-color;
      margin: 0 0 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: color 0.2s;
    }
    
    .r-work--related_author {
      font-size: 12px;
      color: $text-muted;
      margin: 0;
    }
  }
}

.r-work--share_content {
  text-align: center;
  
  .r-work--share_qrcode {
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
  
  .r-work--share_link {
    margin-bottom: 16px;
  }
  
  .r-work--share_platforms {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    
    .r-work--share_label {
      font-size: 14px;
      color: $text-muted;
    }
  }
  
  .r-work--share_icon {
    display: inline-block;
    width: 20px;
    height: 20px;
    
    &.r-work--share_icon_weibo {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23E6162D'%3E%3Cpath d='M10.098 20c-4.612 0-8.363-2.222-8.363-4.958 0-1.428.93-3.08 2.527-4.648 2.126-2.09 4.604-3.038 5.528-2.118.406.404.49 1.096.25 1.9-.166.55.26.384.26.384 1.59-.612 3.038-.578 3.576.204.28.408.312.912.098 1.468-.124.322-.01.376.194.332 1.062-.226 1.906-.092 2.33.424.46.56.398 1.434-.094 2.416-.026.052-.004.118.052.138.284.102.616.322.816.628.424.642.316 1.524-.282 2.304-1.068 1.428-3.58 2.526-6.892 2.526zm-2.2-8.06c-2.264.168-3.976 1.406-3.824 2.764.152 1.358 2.104 2.324 4.368 2.156 2.264-.168 3.976-1.406 3.824-2.764-.152-1.358-2.104-2.324-4.368-2.156zm1.646 3.19c-.59.206-1.276-.016-1.534-.494-.256-.478.016-1.024.606-1.23.602-.208 1.3.014 1.56.494.258.48-.028 1.028-.632 1.23zm1.046-1.186c-.166.058-.36-.004-.43-.138-.07-.134.01-.286.176-.344.168-.058.36.004.43.138.07.134-.01.286-.176.344zm8.03-5.298c-.38-2.242-2.452-3.762-4.748-3.506-.424.046-.728.426-.682.85.046.422.426.726.85.68 1.49-.168 2.834.82 3.08 2.27.244 1.45-.728 2.828-2.218 3.126-.42.088-.69.498-.602.918.088.42.498.69.918.602 2.264-.454 3.782-2.6 3.402-4.94zm-1.652.28c-.19-1.122-1.226-1.882-2.374-1.754-.424.046-.728.426-.682.85.046.422.426.726.85.68.548-.06 1.048.326 1.144.876.096.55-.266 1.072-.814 1.186-.42.088-.69.498-.602.918.088.42.498.69.918.602 1.138-.24 1.95-1.336 1.76-2.558z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
    
    &.r-work--share_icon_qq {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2312B7F5'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 13.19c-.22.63-.76 1.17-1.37 1.37-.36.12-.73.19-1.1.19-.58 0-1.15-.15-1.67-.44-.25.14-.53.22-.82.22-.29 0-.57-.08-.82-.22-.52.29-1.09.44-1.67.44-.37 0-.74-.07-1.1-.19-.61-.2-1.15-.74-1.37-1.37-.14-.4-.14-.82-.02-1.22.12-.4.36-.76.68-1.02-.08-.28-.12-.58-.12-.88 0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5c0 .3-.04.6-.12.88.32.26.56.62.68 1.02.12.4.12.82-.02 1.22z'/%3E%3C/svg%3E") no-repeat center;
      background-size: contain;
    }
  }
}
</style>

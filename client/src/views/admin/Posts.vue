<template>
  <div class="r-admin-posts--page">
    <div class="r-admin-posts--toolbar">
      <el-input v-model="searchKeyword" placeholder="搜索帖子" clearable class="r-admin-posts--search" @keyup.enter="handleSearch">
        <template #append><el-button @click="handleSearch">搜索</el-button></template>
      </el-input>
      <el-button type="primary" @click="fetchPosts">刷新</el-button>
    </div>

    <el-table :data="posts" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column label="作者" width="120">
        <template #default="{ row }">{{ row.author?.nickname || row.author?.username }}</template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="100">
        <template #default="{ row }">{{ categoryMap[row.category] || row.category }}</template>
      </el-table-column>
      <el-table-column prop="view_count" label="浏览" width="80" />
      <el-table-column prop="like_count" label="点赞" width="80" />
      <el-table-column prop="comment_count" label="评论" width="80" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'published' ? 'success' : row.status === 'hidden' ? 'warning' : 'info'">
            {{ row.status === 'published' ? '正常' : row.status === 'hidden' ? '隐藏' : row.status === 'draft' ? '草稿' : row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="r-admin-posts--pagination">
      <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchPosts" />
    </div>

    <!-- 帖子详情弹窗(编辑+操作) -->
    <el-dialog v-model="detailVisible" title="帖子详情" width="600px" destroy-on-close>
      <div v-if="editingPost">
        <el-descriptions :column="2" border size="small" style="margin-bottom: 16px;">
          <el-descriptions-item label="ID">{{ editingPost.id }}</el-descriptions-item>
          <el-descriptions-item label="作者">{{ editingPost.author?.nickname || editingPost.author?.username }}</el-descriptions-item>
          <el-descriptions-item label="浏览">{{ editingPost.view_count }}</el-descriptions-item>
          <el-descriptions-item label="点赞">{{ editingPost.like_count }}</el-descriptions-item>
          <el-descriptions-item label="评论">{{ editingPost.comment_count }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="editingPost.status === 'active' ? 'success' : 'info'">{{ editingPost.status === 'active' ? '正常' : '隐藏' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(editingPost.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDate(editingPost.updated_at) }}</el-descriptions-item>
        </el-descriptions>

        <el-form label-width="80px">
          <el-form-item label="标题">
            <el-input v-model="editForm.title" />
          </el-form-item>
          <el-form-item label="分类">
            <el-select v-model="editForm.category" style="width: 100%">
              <el-option label="讨论" value="discussion" />
              <el-option label="问答" value="question" />
              <el-option label="分享" value="share" />
              <el-option label="教程" value="tutorial" />
              <el-option label="公告" value="news" />
            </el-select>
          </el-form-item>
          <el-form-item label="精选">
            <el-switch v-model="editForm.is_essence" />
          </el-form-item>
          <el-form-item label="置顶">
            <el-switch v-model="editForm.is_top" />
          </el-form-item>
        </el-form>

        <div style="display: flex; justify-content: space-between; gap: 8px; margin-top: 16px;">
          <el-button type="danger" @click="handleDeletePost">删除帖子</el-button>
          <div style="display: flex; gap: 8px;">
            <el-button @click="detailVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSavePost">保存修改</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const posts = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchKeyword = ref('')

// 帖子详情弹窗
const detailVisible = ref(false)
const editingPost = ref(null)
const editForm = reactive({ title: '', category: '', is_essence: false, is_top: false })

const categoryMap = { discussion: '讨论', question: '问答', share: '分享', tutorial: '教程', news: '公告' }

const fetchPosts = async () => {
  loading.value = true
  try {
    const res = await adminApi.getPosts({ page: currentPage.value, pageSize: pageSize.value, keyword: searchKeyword.value })
    if (res.code === 200) { posts.value = res.data.list; total.value = res.data.total }
  } catch (e) { ElMessage.error('获取帖子列表失败') } finally { loading.value = false }
}

const handleSearch = () => { currentPage.value = 1; fetchPosts() }

const openDetail = (post) => {
  editingPost.value = post
  editForm.title = post.title || ''
  editForm.category = post.category || 'discussion'
  editForm.is_essence = !!post.is_essence
  editForm.is_top = !!post.is_top
  detailVisible.value = true
}

const handleSavePost = async () => {
  try {
    const res = await adminApi.updatePost(editingPost.value.id, {
      title: editForm.title.trim(),
      category: editForm.category,
      is_essence: editForm.is_essence,
      is_top: editForm.is_top
    })
    if (res.code === 200) {
      ElMessage.success('保存成功')
      detailVisible.value = false
      fetchPosts()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) { ElMessage.error('保存失败') }
}

const handleDeletePost = async () => {
  try {
    await ElMessageBox.confirm('确定删除该帖子？此操作不可恢复。', '确认删除', { type: 'warning' })
    const res = await adminApi.deletePost(editingPost.value.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      detailVisible.value = false
      fetchPosts()
    } else { ElMessage.error(res.msg || '删除失败') }
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

const formatDate = (t) => {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(fetchPosts)
</script>

<style lang="scss" scoped>
.r-admin-posts--page { background: #fff; border-radius: 12px; padding: 24px; }
.r-admin-posts--toolbar { display: flex; gap: 12px; margin-bottom: 20px; .r-admin-posts--search { width: 300px; } }
.r-admin-posts--pagination { display: flex; justify-content: flex-end; margin-top: 20px; }
</style>
<template>
  <div class="r-admin-posts--page">
    <div class="r-admin-posts--toolbar">
      <el-input v-model="searchKeyword" placeholder="搜索帖子" clearable class="r-admin-posts--search" @keyup.enter="handleSearch">
        <template #append><el-button @click="handleSearch">搜索</el-button></template>
      </el-input>
      <el-button type="primary" @click="fetchPosts">刷新</el-button>
      <el-button @click="openBoardManager">板块管理</el-button>
    </div>

    <el-table :data="posts" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column label="作者" width="120">
        <template #default="{ row }">{{ row.author?.nickname || row.author?.username }}</template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="100">
        <template #default="{ row }">{{ row.board ? `${row.board.icon} ${row.board.name}` : (categoryMap[row.category] || row.category) }}</template>
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

    <el-dialog v-model="boardManagerVisible" title="论坛板块管理" width="860px" destroy-on-close>
      <div class="r-admin-posts--board_toolbar">
        <span>板块停用后不会丢失历史帖子；有内容的板块删除时会自动改为停用。</span>
        <el-button type="primary" @click="openBoardEditor()">新增板块</el-button>
      </div>
      <el-table :data="boards" v-loading="boardsLoading" border>
        <el-table-column label="板块" min-width="180"><template #default="{ row }"><b>{{ row.icon }} {{ row.name }}</b><div class="r-admin-posts--board_slug">{{ row.slug }}</div></template></el-table-column>
        <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
        <el-table-column prop="post_count" label="帖子" width="70" />
        <el-table-column prop="sort_order" label="排序" width="70" />
        <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="150"><template #default="{ row }"><el-button size="small" @click="openBoardEditor(row)">编辑</el-button><el-button size="small" type="danger" plain @click="removeBoard(row)">删除</el-button></template></el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="boardEditorVisible" :title="boardForm.id ? '编辑板块' : '新增板块'" width="560px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="boardForm.name" maxlength="50" /></el-form-item>
        <el-form-item label="标识"><el-input v-model="boardForm.slug" placeholder="例如 qa-help" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="boardForm.description" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>
        <el-form-item label="图标/颜色"><el-input v-model="boardForm.icon" style="width:100px" /><el-color-picker v-model="boardForm.color" style="margin-left:12px" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="boardForm.sort_order" :min="0" :max="9999" /></el-form-item>
        <el-form-item label="状态"><el-radio-group v-model="boardForm.status"><el-radio label="active">启用</el-radio><el-radio label="disabled">停用</el-radio></el-radio-group></el-form-item>
        <el-form-item label="允许发帖"><el-checkbox-group v-model="boardForm.allow_post_roles"><el-checkbox v-for="role in roleOptions" :key="role.value" :label="role.value">{{ role.label }}</el-checkbox></el-checkbox-group></el-form-item>
      </el-form>
      <template #footer><el-button @click="boardEditorVisible = false">取消</el-button><el-button type="primary" :loading="boardSaving" @click="saveBoard">保存</el-button></template>
    </el-dialog>

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
            <el-select v-model="editForm.board_id" style="width: 100%">
              <el-option v-for="board in boards" :key="board.id" :label="`${board.icon} ${board.name}`" :value="board.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="帖子类型">
            <el-select v-model="editForm.post_type" style="width:100%"><el-option label="普通讨论" value="discussion" /><el-option label="问答求助" value="question" /><el-option label="分享" value="share" /><el-option label="教程" value="tutorial" /><el-option label="公告" value="news" /></el-select>
          </el-form-item>
          <el-form-item label="精选">
            <el-switch v-model="editForm.is_essence" />
          </el-form-item>
          <el-form-item label="置顶">
            <el-switch v-model="editForm.is_top" />
          </el-form-item>
          <el-form-item label="锁定回复"><el-switch v-model="editForm.is_locked" /></el-form-item>
          <el-form-item label="慢速模式">
            <el-input-number v-model="editForm.slow_mode_seconds" :min="0" :max="86400" :step="30" />
            <span class="r-admin-posts--hint">秒，0 表示关闭</span>
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
const boards = ref([])
const boardsLoading = ref(false)
const boardManagerVisible = ref(false)
const boardEditorVisible = ref(false)
const boardSaving = ref(false)
const roleOptions = [
  { value: 'user', label: '普通用户' }, { value: 'reviewer', label: '审核员' },
  { value: 'moderator', label: '版主' }, { value: 'admin', label: '管理员' }, { value: 'superadmin', label: '超级管理员' }
]
const boardForm = reactive({ id: null, name: '', slug: '', description: '', icon: '💬', color: '#fec433', sort_order: 0, status: 'active', allow_post_roles: ['user', 'reviewer', 'moderator', 'admin', 'superadmin'] })

// 帖子详情弹窗
const detailVisible = ref(false)
const editingPost = ref(null)
const editForm = reactive({ title: '', board_id: null, post_type: 'discussion', is_essence: false, is_top: false, is_locked: false, slow_mode_seconds: 0 })

const categoryMap = { discussion: '讨论', question: '问答', share: '分享', tutorial: '教程', news: '公告' }

const fetchPosts = async () => {
  loading.value = true
  try {
    const res = await adminApi.getPosts({ page: currentPage.value, pageSize: pageSize.value, keyword: searchKeyword.value })
    if (res.code === 200) { posts.value = res.data.list; total.value = res.data.total }
  } catch (e) { ElMessage.error('获取帖子列表失败') } finally { loading.value = false }
}

const handleSearch = () => { currentPage.value = 1; fetchPosts() }

const loadBoards = async () => {
  boardsLoading.value = true
  try {
    const res = await adminApi.getForumBoards()
    if (res.code === 200) boards.value = res.data || []
  } catch (e) { ElMessage.error('获取论坛板块失败') }
  finally { boardsLoading.value = false }
}

const openBoardManager = async () => {
  boardManagerVisible.value = true
  await loadBoards()
}

const openBoardEditor = (board = null) => {
  Object.assign(boardForm, board ? {
    id: board.id, name: board.name, slug: board.slug, description: board.description || '', icon: board.icon || '💬',
    color: board.color || '#fec433', sort_order: Number(board.sort_order || 0), status: board.status || 'active',
    allow_post_roles: Array.isArray(board.allow_post_roles) ? [...board.allow_post_roles] : []
  } : { id: null, name: '', slug: '', description: '', icon: '💬', color: '#fec433', sort_order: 0, status: 'active', allow_post_roles: ['user', 'reviewer', 'moderator', 'admin', 'superadmin'] })
  boardEditorVisible.value = true
}

const saveBoard = async () => {
  if (!boardForm.name.trim() || !boardForm.slug.trim()) return ElMessage.warning('请填写板块名称和标识')
  boardSaving.value = true
  try {
    const payload = { ...boardForm }
    delete payload.id
    const res = boardForm.id ? await adminApi.updateForumBoard(boardForm.id, payload) : await adminApi.createForumBoard(payload)
    if (res.code === 200) {
      ElMessage.success(res.msg || '保存成功')
      boardEditorVisible.value = false
      await loadBoards()
      fetchPosts()
    }
  } catch (e) { ElMessage.error(e.response?.data?.msg || '保存板块失败') }
  finally { boardSaving.value = false }
}

const removeBoard = async board => {
  try {
    await ElMessageBox.confirm(`确定处理板块“${board.name}”吗？已有帖子时只会安全停用。`, '删除板块', { type: 'warning' })
    const res = await adminApi.deleteForumBoard(board.id)
    if (res.code === 200) { ElMessage.success(res.msg); await loadBoards(); fetchPosts() }
  } catch (e) { if (e !== 'cancel') ElMessage.error(e.response?.data?.msg || '操作失败') }
}

const openDetail = async (post) => {
  if (!boards.value.length) await loadBoards()
  editingPost.value = post
  editForm.title = post.title || ''
  editForm.board_id = post.board_id || null
  editForm.post_type = post.post_type || post.category || 'discussion'
  editForm.is_essence = !!post.is_essence
  editForm.is_top = !!post.is_top
  editForm.is_locked = !!post.is_locked
  editForm.slow_mode_seconds = Number(post.slow_mode_seconds || 0)
  detailVisible.value = true
}

const handleSavePost = async () => {
  try {
    const res = await adminApi.updatePost(editingPost.value.id, {
      title: editForm.title.trim(),
      board_id: editForm.board_id,
      post_type: editForm.post_type,
      is_essence: editForm.is_essence,
      is_top: editForm.is_top,
      is_locked: editForm.is_locked,
      slow_mode_seconds: editForm.slow_mode_seconds
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
.r-admin-posts--hint { margin-left: 10px; color: #999; font-size: 12px; }
.r-admin-posts--board_toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; color:#7c8799; font-size:13px; }
.r-admin-posts--board_slug { margin-top:3px; color:#98a2b3; font-size:11px; }
</style>

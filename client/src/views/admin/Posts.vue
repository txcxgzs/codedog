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
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column label="作者" width="120">
        <template #default="{ row }">{{ row.author?.nickname || row.author?.username }}</template>
      </el-table-column>
      <el-table-column label="分类" width="120">
        <template #default="{ row }">
          <el-select v-model="row.category" size="small" @change="updateCategory(row)">
            <el-option label="讨论" value="discussion" />
            <el-option label="问答" value="question" />
            <el-option label="分享" value="share" />
            <el-option label="教程" value="tutorial" />
            <el-option label="公告" value="news" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column prop="view_count" label="浏览" width="80" />
      <el-table-column prop="like_count" label="点赞" width="80" />
      <el-table-column prop="comment_count" label="评论" width="80" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '正常' : '隐藏' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="精选" width="80">
        <template #default="{ row }">
          <el-switch v-model="row.is_essence" @change="toggleEssence(row)" />
        </template>
      </el-table-column>
      <el-table-column label="置顶" width="80">
        <template #default="{ row }">
          <el-switch v-model="row.is_top" @change="toggleTop(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/post/${row.id}`)">查看</el-button>
          <el-button size="small" type="danger" @click="deletePost(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <div class="r-admin-posts--pagination">
      <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchPosts" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const posts = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchKeyword = ref('')

const fetchPosts = async () => {
  loading.value = true
  try {
    const res = await adminApi.getPosts({ page: currentPage.value, pageSize: pageSize.value, keyword: searchKeyword.value })
    if (res.code === 200) { posts.value = res.data.list; total.value = res.data.total }
  } catch (e) {} finally { loading.value = false }
}

const handleSearch = () => { currentPage.value = 1; fetchPosts() }

const updateCategory = async (post) => {
  try {
    const res = await adminApi.updatePost(post.id, { category: post.category })
    if (res.code === 200) {
      ElMessage.success('分类已更新')
    } else {
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const toggleEssence = async (post) => {
  try {
    const res = await adminApi.setPostEssence(post.id, post.is_essence)
    if (res.code === 200) {
      ElMessage.success(post.is_essence ? '已设为精华' : '已取消精华')
    } else {
      post.is_essence = !post.is_essence
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    post.is_essence = !post.is_essence
    ElMessage.error('操作失败')
  }
}

const toggleTop = async (post) => {
  try {
    const res = await adminApi.setPostTop(post.id, post.is_top)
    if (res.code === 200) {
      ElMessage.success(post.is_top ? '已置顶' : '已取消置顶')
    } else {
      post.is_top = !post.is_top
      ElMessage.error(res.msg || '操作失败')
    }
  } catch (e) {
    post.is_top = !post.is_top
    ElMessage.error('操作失败')
  }
}

const deletePost = async (post) => {
  try {
    await ElMessageBox.confirm('确定删除该帖子？', '提示', { type: 'warning' })
    const res = await adminApi.deletePost(post.id)
    if (res.code === 200) { ElMessage.success('删除成功'); fetchPosts() }
  } catch (e) {}
}

onMounted(fetchPosts)
</script>

<style lang="scss" scoped>
.r-admin-posts--page { background: #fff; border-radius: 12px; padding: 24px; }
.r-admin-posts--toolbar { display: flex; gap: 12px; margin-bottom: 20px; .r-admin-posts--search { width: 300px; } }
.r-admin-posts--pagination { display: flex; justify-content: flex-end; margin-top: 20px; }
</style>

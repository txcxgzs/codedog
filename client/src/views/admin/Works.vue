<template>
  <div class="r-admin-works--page">
    <!-- 搜索栏 -->
    <div class="r-admin-works--toolbar">
      <el-input 
        v-model="searchKeyword" 
        placeholder="搜索作品名称"
        clearable
        class="r-admin-works--search"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>
      <el-button type="primary" @click="fetchWorks">刷新</el-button>
    </div>
    
    <!-- 作品列表 -->
    <el-table :data="works" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="封面" width="120">
        <template #default="{ row }">
          <img :src="row.preview" class="r-admin-works--cover" />
        </template>
      </el-table-column>
      <el-table-column prop="name" label="作品名称" min-width="200" />
      <el-table-column label="作者" width="150">
        <template #default="{ row }">
          {{ row.author?.nickname || row.author?.username }}
        </template>
      </el-table-column>
      <el-table-column prop="type" label="类型" width="100" />
      <el-table-column prop="view_times" label="浏览" width="80" />
      <el-table-column prop="praise_times" label="点赞" width="80" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'published' ? 'success' : 'info'">
            {{ row.status === 'published' ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="120">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/work/${row.codemao_work_id}`)">查看</el-button>
          <el-button size="small" @click="editWork(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteWork(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <!-- 分页 -->
    <div class="r-admin-works--pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="fetchWorks"
      />
    </div>

    <!-- 编辑作品对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑作品" width="500px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="作品名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="浏览量">
          <el-input-number v-model="editForm.view_times" :min="0" />
        </el-form-item>
        <el-form-item label="点赞数">
          <el-input-number v-model="editForm.praise_times" :min="0" />
        </el-form-item>
        <el-form-item label="收藏数">
          <el-input-number v-model="editForm.collection_times" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status">
            <el-option label="已发布" value="published" />
            <el-option label="草稿" value="draft" />
            <el-option label="已删除" value="deleted" />
          </el-select>
        </el-form-item>
        <el-form-item label="推荐">
          <el-switch v-model="editForm.is_featured" active-text="推荐作品" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveWork">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const works = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchKeyword = ref('')
const editDialogVisible = ref(false)
const editForm = ref({})

const formatTime = (time) => {
  if (!time) return '-'
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fetchWorks = async () => {
  loading.value = true
  try {
    const res = await adminApi.getWorks({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value
    })
    if (res.code === 200) {
      works.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('获取作品失败:', e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchWorks()
}

const editWork = (work) => {
  editForm.value = { ...work }
  editDialogVisible.value = true
}

const saveWork = async () => {
  try {
    // 假设 adminApi 有 updateWork 方法，如果没有需要添加
    // 这里暂时使用假设的 API
    const res = await adminApi.updateWork(editForm.value.id, {
      name: editForm.value.name,
      view_times: editForm.value.view_times,
      praise_times: editForm.value.praise_times,
      collection_times: editForm.value.collection_times,
      status: editForm.value.status,
      is_featured: editForm.value.is_featured
    })
    if (res.code === 200) {
      ElMessage.success('保存成功')
      editDialogVisible.value = false
      fetchWorks()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const deleteWork = async (work) => {
  try {
    await ElMessageBox.confirm('确定要删除该作品吗？', '提示', { type: 'warning' })
    const res = await adminApi.deleteWork(work.id)
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
.r-admin-works--page {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}

.r-admin-works--toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  
  .r-admin-works--search {
    width: 300px;
  }
}

.r-admin-works--cover {
  width: 100px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.r-admin-works--pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>

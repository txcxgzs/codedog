<template>
  <div class="r-admin-announcements--page">
    <!-- 工具栏 -->
    <div class="r-admin-announcements--toolbar">
      <el-button type="primary" @click="openDialog()">添加公告</el-button>
    </div>
    
    <!-- 列表 -->
    <el-table :data="announcements" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column prop="content" label="内容" min-width="300">
        <template #default="{ row }">
          <span class="r-admin-announcements--content">{{ row.content }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="type" label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'important' ? 'danger' : 'info'">
            {{ row.type === 'important' ? '重要' : '普通' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '显示' : '隐藏' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="120">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteAnnouncement(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editForm.id ? '编辑公告' : '添加公告'" width="500px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="editForm.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="editForm.type">
            <el-option label="普通" value="normal" />
            <el-option label="重要" value="important" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status">
            <el-option label="显示" value="active" />
            <el-option label="隐藏" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAnnouncement">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const announcements = ref([])
const dialogVisible = ref(false)
const editForm = ref({
  title: '',
  content: '',
  type: 'normal',
  status: 'active'
})

const formatTime = (time) => {
  if (!time) return '-'
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fetchAnnouncements = async () => {
  loading.value = true
  try {
    const res = await adminApi.getAnnouncements()
    if (res.code === 200) {
      announcements.value = res.data
    }
  } catch (e) {
    console.error('获取公告失败:', e)
  } finally {
    loading.value = false
  }
}

const openDialog = (announcement = null) => {
  if (announcement) {
    editForm.value = { ...announcement }
  } else {
    editForm.value = {
      title: '',
      content: '',
      type: 'normal',
      status: 'active'
    }
  }
  dialogVisible.value = true
}

const saveAnnouncement = async () => {
  try {
    let res
    if (editForm.value.id) {
      res = await adminApi.updateAnnouncement(editForm.value.id, editForm.value)
    } else {
      res = await adminApi.createAnnouncement(editForm.value)
    }
    if (res.code === 200) {
      ElMessage.success('保存成功')
      dialogVisible.value = false
      fetchAnnouncements()
    } else {
      ElMessage.error(res.msg || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const deleteAnnouncement = async (announcement) => {
  try {
    await ElMessageBox.confirm('确定要删除该公告吗？', '提示', { type: 'warning' })
    const res = await adminApi.deleteAnnouncement(announcement.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchAnnouncements()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(fetchAnnouncements)
</script>

<style lang="scss" scoped>
.r-admin-announcements--page {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}

.r-admin-announcements--toolbar {
  margin-bottom: 20px;
}

.r-admin-announcements--content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

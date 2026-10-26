<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { formatApiError } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import { createProject, listProjects, type ProjectView } from './projectApi'

const router = useRouter()
const auth = useAuthStore()
const projects = ref<ProjectView[]>([])
const page = ref(1)
const total = ref(0)
const statusFilter = ref<'ACTIVE' | 'ARCHIVED' | ''>('')
const loading = ref(false)
const submitting = ref(false)
const dialogOpen = ref(false)
const name = ref('')
const description = ref('')
const errorMessage = ref('')

async function loadProjects(nextPage = page.value): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listProjects(nextPage, statusFilter.value || undefined)
    projects.value = result.items
    page.value = result.page
    total.value = result.total
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function submitProject(): Promise<void> {
  if (!name.value.trim()) {
    errorMessage.value = '请输入项目名称'
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const project = await createProject(name.value.trim(), description.value.trim())
    dialogOpen.value = false
    name.value = ''
    description.value = ''
    await router.push({ name: 'project-detail', params: { id: project.id } })
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

async function clearFilter(): Promise<void> {
  statusFilter.value = ''
  await loadProjects(1)
}

async function logout(): Promise<void> {
  try {
    await auth.logout()
  } catch (error) {
    ElMessage.error(`退出请求失败：${formatApiError(error)}`)
  } finally {
    await router.push({ name: 'login' })
  }
}

onMounted(() => {
  void loadProjects()
})
</script>

<template>
  <main class="page-shell">
    <header class="page-header">
      <div>
        <h1>TeamFlow 项目</h1>
        <p>你好，{{ auth.user?.displayName }}。查看你参与的项目。</p>
      </div>
      <div class="actions">
        <el-button v-if="auth.user?.systemAdmin" @click="router.push({ name: 'admin-users' })"
          >账号管理</el-button
        >
        <el-button type="primary" @click="dialogOpen = true">创建项目</el-button>
        <el-button @click="logout">退出登录</el-button>
      </div>
    </header>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <div class="filter-row">
      <el-select v-model="statusFilter" clearable placeholder="全部状态">
        <el-option label="活跃" value="ACTIVE" />
        <el-option label="已归档" value="ARCHIVED" />
      </el-select>
      <el-button type="primary" @click="loadProjects(1)">筛选</el-button>
      <el-button @click="clearFilter">清空</el-button>
    </div>
    <el-card v-loading="loading">
      <el-table :data="projects" empty-text="暂无项目，创建第一个项目吧">
        <el-table-column prop="name" label="项目" min-width="220" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column label="操作" width="120"
          ><template #default="scope"
            ><el-button
              link
              type="primary"
              @click="router.push({ name: 'project-detail', params: { id: scope.row.id } })"
              >查看</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        class="pager"
        layout="prev, pager, next, total"
        :current-page="page"
        :page-size="20"
        :total="total"
        @current-change="loadProjects"
      />
    </el-card>
    <el-dialog v-model="dialogOpen" title="创建项目" width="min(480px, 92vw)">
      <el-form label-position="top" @submit.prevent="submitProject">
        <el-form-item label="项目名称"
          ><el-input v-model="name" maxlength="160" show-word-limit
        /></el-form-item>
        <el-form-item label="说明"
          ><el-input v-model="description" type="textarea" maxlength="10000"
        /></el-form-item>
        <el-button type="primary" native-type="submit" :loading="submitting">创建</el-button>
      </el-form>
    </el-dialog>
  </main>
</template>

<style scoped>
.page-shell {
  max-width: 1180px;
  margin: 36px auto;
  padding: 0 24px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}
.page-header h1 {
  margin: 0 0 8px;
}
.page-header p {
  margin: 0;
  color: #667085;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pager {
  margin-top: 20px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.filter-row .el-select {
  width: 180px;
}
@media (max-width: 720px) {
  .page-shell {
    margin: 16px auto;
    padding: 0 16px;
  }
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-row {
    flex-wrap: wrap;
  }
  .filter-row .el-select {
    width: 100%;
  }
}
</style>

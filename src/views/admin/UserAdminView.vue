<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { formatApiError } from '../../api/client'
import { changeUserStatus, createUser, listUsers, type AdminUser } from './adminApi'

const router = useRouter()
const users = ref<AdminUser[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const dialogOpen = ref(false)
const errorMessage = ref('')
const username = ref('')
const password = ref('')
const displayName = ref('')
const email = ref('')

function resetForm(): void {
  username.value = ''
  password.value = ''
  displayName.value = ''
  email.value = ''
}

async function load(nextPage = page.value): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listUsers(nextPage)
    users.value = result.items
    total.value = result.total
    page.value = result.page
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function submit(): Promise<void> {
  if (!username.value.trim() || !displayName.value.trim() || password.value.length < 12) {
    errorMessage.value = '请输入用户名、姓名和至少 12 位密码'
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    await createUser({
      username: username.value.trim(),
      displayName: displayName.value.trim(),
      password: password.value,
      email: email.value.trim() || undefined,
    })
    dialogOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function toggle(user: AdminUser): Promise<void> {
  const next = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try {
    await ElMessageBox.confirm(`确定将 ${user.username} 设为 ${next} 吗？`, '修改账号状态')
    await changeUserStatus(user.id, next)
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') errorMessage.value = formatApiError(error)
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <main class="page-shell">
    <header class="page-header">
      <div>
        <el-button link @click="router.push({ name: 'home' })">← 返回项目</el-button>
        <h1>账号管理</h1>
      </div>
      <el-button type="primary" @click="dialogOpen = true">创建账号</el-button>
    </header>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-card v-loading="loading">
      <el-table :data="users" empty-text="暂无账号">
        <el-table-column prop="id" label="用户 ID" width="130" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="displayName" label="姓名" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column label="操作" width="130"
          ><template #default="scope"
            ><el-button link @click="toggle(scope.row)">{{
              scope.row.status === 'ACTIVE' ? '禁用' : '启用'
            }}</el-button></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        class="pager"
        layout="prev, pager, next, total"
        :current-page="page"
        :page-size="20"
        :total="total"
        @current-change="load"
      />
    </el-card>
    <el-dialog v-model="dialogOpen" title="创建账号" width="480px" @closed="resetForm">
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名"><el-input v-model="username" maxlength="64" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="displayName" maxlength="100" /></el-form-item>
        <el-form-item label="邮箱（可选）"><el-input v-model="email" type="email" /></el-form-item>
        <el-form-item label="初始密码"
          ><el-input v-model="password" type="password" show-password autocomplete="new-password"
        /></el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading">创建</el-button>
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.pager {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>

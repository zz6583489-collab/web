<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { formatApiError } from '../../api/client'
import { changeUserStatus, createUser, listUsers, type AdminUser } from './adminApi'

const users = ref<AdminUser[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const submitting = ref(false)
const changingId = ref<string | null>(null)
const dialogOpen = ref(false)
const errorMessage = ref('')
const dialogError = ref('')
const username = ref('')
const password = ref('')
const displayName = ref('')
const email = ref('')
const activeOnPage = computed(() => users.value.filter((user) => user.status === 'ACTIVE').length)
const disabledOnPage = computed(
  () => users.value.filter((user) => user.status === 'DISABLED').length,
)

function resetForm(): void {
  username.value = ''
  password.value = ''
  displayName.value = ''
  email.value = ''
  dialogError.value = ''
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
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username.value.trim())) {
    dialogError.value = '用户名须为 3 至 64 位字母、数字、点、下划线或短横线'
    return
  }
  if (!displayName.value.trim() || password.value.length < 12 || password.value.length > 128) {
    dialogError.value = '请输入姓名和 12 至 128 位初始密码'
    return
  }
  submitting.value = true
  dialogError.value = ''
  try {
    await createUser({
      username: username.value.trim(),
      displayName: displayName.value.trim(),
      password: password.value,
      email: email.value.trim() || undefined,
    })
    dialogOpen.value = false
    resetForm()
    await load(1)
  } catch (error) {
    dialogError.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

async function toggle(id: string): Promise<void> {
  const user = users.value.find((entry) => entry.id === id)
  if (!user) return
  const next = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  errorMessage.value = ''
  try {
    await ElMessageBox.confirm(
      next === 'DISABLED'
        ? '禁用后 ' +
            user.displayName +
            ' 的访问令牌和刷新会话会立即失效，历史记录仍保留。确定继续吗？'
        : '确定重新启用 ' + user.displayName + ' 的账号吗？',
      next === 'DISABLED' ? '禁用账号' : '启用账号',
      {
        confirmButtonText: next === 'DISABLED' ? '确认禁用' : '确认启用',
        cancelButtonText: '取消',
        type: next === 'DISABLED' ? 'warning' : 'info',
      },
    )
    changingId.value = user.id
    await changeUserStatus(user.id, next)
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') errorMessage.value = formatApiError(error)
  } finally {
    changingId.value = null
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <main class="tf-page user-admin">
    <header class="tf-page-heading">
      <div>
        <span class="tf-eyebrow">SYSTEM ADMINISTRATION</span>
        <h1>账号管理</h1>
        <p>集中创建和管理团队账号，权限变更即时生效。</p>
      </div>
      <el-button type="primary" @click="dialogOpen = true">＋ 创建账号</el-button>
    </header>
    <el-alert
      v-if="errorMessage"
      class="tf-error-alert"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />
    <div class="admin-metrics">
      <div class="tf-surface">
        <strong>{{ total }}</strong
        ><span>全部账号</span>
      </div>
      <div class="tf-surface">
        <strong>{{ activeOnPage }}</strong
        ><span>本页正常使用</span>
      </div>
      <div class="tf-surface">
        <strong>{{ disabledOnPage }}</strong
        ><span>本页已禁用</span>
      </div>
    </div>
    <section>
      <div class="tf-section-heading">
        <div>
          <h2>账号列表</h2>
          <p>仅系统管理员可创建账号与修改状态。</p>
        </div>
        <span class="tf-hint">系统管理员不自动拥有项目访问权</span>
      </div>
      <div v-loading="loading" class="tf-surface admin-table">
        <el-table :data="users" empty-text="暂无账号"
          ><el-table-column label="账号" min-width="220"
            ><template #default="scope"
              ><div class="admin-person">
                <span class="tf-avatar">{{ scope.row.displayName.slice(0, 1) }}</span
                ><span
                  ><strong>{{ scope.row.displayName }}</strong
                  ><small>{{ scope.row.username }}</small></span
                >
              </div></template
            ></el-table-column
          ><el-table-column prop="id" label="用户 ID" min-width="110" /><el-table-column
            label="邮箱"
            min-width="200"
            ><template #default="scope">{{
              scope.row.email || '未填写'
            }}</template></el-table-column
          ><el-table-column label="状态" min-width="120"
            ><template #default="scope"
              ><span
                class="tf-status"
                :class="scope.row.status === 'ACTIVE' ? 'active' : 'archived'"
                >{{ scope.row.status === 'ACTIVE' ? '● 正常' : '● 已禁用' }}</span
              ></template
            ></el-table-column
          ><el-table-column label="操作" width="110"
            ><template #default="scope"
              ><el-button
                link
                :type="scope.row.status === 'ACTIVE' ? 'danger' : 'primary'"
                :loading="changingId === scope.row.id"
                @click="toggle(String(scope.row.id))"
                >{{ scope.row.status === 'ACTIVE' ? '禁用' : '启用' }}</el-button
              ></template
            ></el-table-column
          ></el-table
        >
      </div>
      <el-pagination
        v-if="total > 20"
        class="tf-pager"
        layout="prev, pager, next, total"
        :current-page="page"
        :page-size="20"
        :total="total"
        @current-change="load"
      />
      <div class="tf-hint-panel admin-security">
        <span class="tf-hint-icon">i</span>
        <div>
          <strong>账号安全</strong>
          <p>
            禁用账号后，访问令牌和刷新会话立即失效。最后一位有效管理员及活跃项目负责人受到保护。
          </p>
        </div>
      </div>
    </section>

    <el-dialog v-model="dialogOpen" title="创建账号" width="590" @closed="resetForm">
      <template #header
        ><div class="tf-dialog-heading">
          <span>ACCOUNT MANAGEMENT · SYSTEM ADMIN</span><strong>创建账号</strong
          ><small>为团队成员建立登录身份，项目权限稍后分配。</small>
        </div></template
      >
      <el-form label-position="top" @submit.prevent="submit"
        ><div class="admin-form-grid">
          <el-form-item label="用户名"
            ><el-input
              v-model="username"
              maxlength="64"
              placeholder="3 至 64 位字母、数字或 ._- " /></el-form-item
          ><el-form-item label="显示姓名"
            ><el-input v-model="displayName" maxlength="100" placeholder="输入姓名"
          /></el-form-item>
        </div>
        <el-form-item label="电子邮箱（可选）"
          ><el-input
            v-model="email"
            type="email"
            maxlength="254"
            placeholder="name@example.com" /></el-form-item
        ><el-form-item label="初始密码"
          ><el-input
            v-model="password"
            type="password"
            autocomplete="new-password"
            show-password
            maxlength="128"
            placeholder="至少 12 位"
        /></el-form-item>
        <p class="tf-hint">创建后请通过安全渠道交付初始密码。</p>
        <div class="tf-hint-panel admin-form-hint">
          <span class="tf-hint-icon">◇</span>
          <div>
            <strong>新账号默认为正常状态</strong>
            <p>不会自动成为系统管理员或任何项目的成员。</p>
          </div>
        </div>
        <el-alert
          v-if="dialogError"
          class="tf-error-alert"
          :title="dialogError"
          type="error"
          :closable="false"
      /></el-form>
      <template #footer
        ><div class="tf-dialog-footer">
          <span>仅系统管理员可创建账号。</span>
          <div>
            <el-button @click="dialogOpen = false">取消</el-button
            ><el-button type="primary" :loading="submitting" @click="submit">创建账号 →</el-button>
          </div>
        </div></template
      >
    </el-dialog>
  </main>
</template>

<style scoped>
.admin-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-bottom: 36px;
}
.admin-metrics > div {
  min-height: 106px;
  padding: 20px 22px;
}
.admin-metrics strong {
  display: block;
  font-size: 28px;
}
.admin-metrics span {
  color: #8a99ad;
  font-size: 11px;
}
.admin-table {
  overflow-x: auto;
}
.admin-table :deep(.el-table) {
  min-width: 690px;
}
.admin-person {
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-person > span:last-child {
  display: grid;
  gap: 4px;
}
.admin-person strong {
  font-size: 11px;
}
.admin-person small {
  color: #a2afc0;
  font-size: 10px;
}
.admin-security {
  margin-top: 23px;
}
.admin-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.admin-form-hint {
  margin: 14px 0;
}
@media (max-width: 767px) {
  .admin-metrics {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .admin-form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>

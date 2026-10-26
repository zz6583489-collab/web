<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { formatApiError } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import TaskDrawer from '../tasks/TaskDrawer.vue'
import {
  createTask,
  listAudit,
  listTasks,
  type AuditView,
  type TaskPriority,
  type TaskView,
} from '../tasks/taskApi'
import {
  addMember,
  archiveProject,
  getProject,
  listMembers,
  removeMember,
  type MemberView,
  type ProjectView,
} from './projectApi'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projectId = computed(() => String(route.params.id))
const project = ref<ProjectView | null>(null)
const members = ref<MemberView[]>([])
const tasks = ref<TaskView[]>([])
const audit = ref<AuditView[]>([])
const auditPage = ref(1)
const auditTotal = ref(0)
const taskPage = ref(1)
const taskTotal = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const newMemberId = ref('')
const newTaskTitle = ref('')
const newTaskDescription = ref('')
const newTaskAssignee = ref('')
const newTaskPriority = ref<TaskPriority>('MEDIUM')
const submitting = ref(false)
const taskDialogOpen = ref(false)
const drawerOpen = ref(false)
const selectedTaskId = ref<string | null>(null)
const isOwner = computed(() => project.value?.ownerId === auth.user?.id)
const isActive = computed(() => project.value?.status === 'ACTIVE')

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const [detail, memberList, taskList] = await Promise.all([
      getProject(projectId.value),
      listMembers(projectId.value),
      listTasks(projectId.value, taskPage.value),
    ])
    project.value = detail
    members.value = memberList
    tasks.value = taskList.items
    taskTotal.value = taskList.total
    if (detail.ownerId === auth.user?.id) {
      const result = await listAudit(projectId.value, auditPage.value)
      audit.value = result.items
      auditTotal.value = result.total
    }
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function loadTaskPage(nextPage: number): Promise<void> {
  taskPage.value = nextPage
  await load()
}

async function loadAuditPage(nextPage: number): Promise<void> {
  auditPage.value = nextPage
  await load()
}

async function submitMember(): Promise<void> {
  if (!newMemberId.value.trim()) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await addMember(projectId.value, newMemberId.value.trim())
    newMemberId.value = ''
    await load()
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

async function remove(userId: string): Promise<void> {
  try {
    await ElMessageBox.confirm('确定移除该成员吗？已指派任务的成员无法移除。', '移除成员')
    await removeMember(projectId.value, userId)
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') errorMessage.value = formatApiError(error)
  }
}

async function submitTask(): Promise<void> {
  if (!newTaskTitle.value.trim()) {
    errorMessage.value = '请输入任务标题'
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    await createTask(projectId.value, {
      title: newTaskTitle.value.trim(),
      description: newTaskDescription.value,
      assigneeId: newTaskAssignee.value || undefined,
      priority: newTaskPriority.value,
    })
    taskDialogOpen.value = false
    newTaskTitle.value = ''
    newTaskDescription.value = ''
    newTaskAssignee.value = ''
    await load()
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

async function archive(): Promise<void> {
  try {
    await ElMessageBox.confirm('归档后项目、成员和任务均只读。确定继续吗？', '归档项目')
    await archiveProject(projectId.value)
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') errorMessage.value = formatApiError(error)
  }
}

function openTask(id: string): void {
  selectedTaskId.value = id
  drawerOpen.value = true
}

onMounted(() => {
  void load()
})
watch(projectId, () => {
  taskPage.value = 1
  auditPage.value = 1
  selectedTaskId.value = null
  drawerOpen.value = false
  void load()
})
</script>

<template>
  <main v-loading="loading" class="page-shell">
    <header class="page-header">
      <div>
        <el-button link @click="router.push({ name: 'home' })">← 返回项目</el-button>
        <h1>{{ project?.name ?? '项目详情' }}</h1>
        <p>{{ project?.description || '暂无项目说明' }} · {{ project?.status }}</p>
      </div>
      <div class="actions">
        <el-button v-if="isOwner && isActive" @click="archive">归档项目</el-button>
        <el-button v-if="isActive" type="primary" @click="taskDialogOpen = true"
          >创建任务</el-button
        >
      </div>
    </header>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-card class="section">
      <template #header>项目成员</template>
      <el-table :data="members" empty-text="暂无成员">
        <el-table-column prop="displayName" label="姓名" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="userId" label="用户 ID" />
        <el-table-column prop="role" label="角色" />
        <el-table-column v-if="isOwner && isActive" label="操作" width="100">
          <template #default="scope"
            ><el-button
              v-if="scope.row.role !== 'OWNER'"
              link
              type="danger"
              @click="remove(scope.row.userId)"
              >移除</el-button
            ></template
          >
        </el-table-column>
      </el-table>
      <el-form v-if="isOwner && isActive" class="inline-form" @submit.prevent="submitMember">
        <el-input v-model="newMemberId" placeholder="输入已创建用户的 ID" />
        <el-button type="primary" native-type="submit" :loading="submitting">添加成员</el-button>
      </el-form>
    </el-card>
    <el-card class="section">
      <template #header>任务</template>
      <el-table :data="tasks" empty-text="暂无任务">
        <el-table-column prop="title" label="标题" min-width="220" />
        <el-table-column prop="status" label="状态" width="130" />
        <el-table-column prop="priority" label="优先级" width="110" />
        <el-table-column prop="assigneeId" label="负责人 ID" width="120" />
        <el-table-column label="操作" width="100"
          ><template #default="scope"
            ><el-button link type="primary" @click="openTask(scope.row.id)"
              >详情</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        class="pager"
        layout="prev, pager, next, total"
        :current-page="taskPage"
        :page-size="20"
        :total="taskTotal"
        @current-change="loadTaskPage"
      />
    </el-card>
    <el-card v-if="isOwner" class="section">
      <template #header>操作审计</template>
      <el-table :data="audit" empty-text="暂无审计记录">
        <el-table-column prop="action" label="操作" />
        <el-table-column prop="actorId" label="操作人 ID" />
        <el-table-column prop="resourceType" label="资源" />
        <el-table-column prop="traceId" label="TraceId" min-width="250" />
        <el-table-column prop="createdAt" label="时间" min-width="190" />
      </el-table>
      <el-pagination
        class="pager"
        layout="prev, pager, next, total"
        :current-page="auditPage"
        :page-size="20"
        :total="auditTotal"
        @current-change="loadAuditPage"
      />
    </el-card>
    <el-dialog v-model="taskDialogOpen" title="创建任务" width="520px">
      <el-form label-position="top" @submit.prevent="submitTask">
        <el-form-item label="标题"
          ><el-input v-model="newTaskTitle" maxlength="200"
        /></el-form-item>
        <el-form-item label="描述"
          ><el-input v-model="newTaskDescription" type="textarea" maxlength="10000"
        /></el-form-item>
        <el-form-item label="负责人"
          ><el-select v-model="newTaskAssignee" clearable placeholder="可暂不指派"
            ><el-option
              v-for="member in members"
              :key="member.userId"
              :label="member.displayName"
              :value="member.userId" /></el-select
        ></el-form-item>
        <el-form-item label="优先级"
          ><el-select v-model="newTaskPriority"
            ><el-option label="低" value="LOW" /><el-option label="中" value="MEDIUM" /><el-option
              label="高"
              value="HIGH" /></el-select
        ></el-form-item>
        <el-button type="primary" native-type="submit" :loading="submitting">创建</el-button>
      </el-form>
    </el-dialog>
    <TaskDrawer
      v-model="drawerOpen"
      :task-id="selectedTaskId"
      :members="members"
      :project-owner="isOwner"
      :project-active="isActive"
      :current-user-id="auth.user?.id ?? ''"
      @updated="load"
    />
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
  margin: 8px 0;
}
.page-header p {
  margin: 0;
  color: #667085;
}
.actions,
.inline-form {
  display: flex;
  gap: 8px;
}
.inline-form {
  margin-top: 20px;
  max-width: 460px;
}
.section {
  margin-bottom: 20px;
}
.pager {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>

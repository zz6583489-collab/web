<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { formatApiError } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import TaskDrawer from '../tasks/TaskDrawer.vue'
import {
  createTask,
  getTaskStats,
  listAudit,
  listTasks,
  type AuditView,
  type AuditFilter,
  type TaskFilter,
  type TaskPriority,
  type TaskStats,
  type TaskStatus,
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
const stats = ref<TaskStats | null>(null)
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
const newTaskDueAt = ref<Date | null>(null)
const taskStatus = ref<TaskStatus | ''>('')
const taskPriority = ref<TaskPriority | ''>('')
const taskAssignee = ref('')
const auditActor = ref('')
const auditAction = ref('')
const auditFrom = ref<Date | null>(null)
const auditTo = ref<Date | null>(null)
const submitting = ref(false)
const taskDialogOpen = ref(false)
const drawerOpen = ref(false)
const selectedTaskId = ref<string | null>(null)
const isOwner = computed(() => project.value?.ownerId === auth.user?.id)
const isActive = computed(() => project.value?.status === 'ACTIVE')

function selectedTaskFilter(): TaskFilter {
  return {
    status: taskStatus.value || undefined,
    priority: taskPriority.value || undefined,
    assigneeId: taskAssignee.value || undefined,
  }
}

function selectedAuditFilter(): AuditFilter {
  return {
    actorId: auditActor.value || undefined,
    action: auditAction.value || undefined,
    from: auditFrom.value?.toISOString(),
    to: auditTo.value?.toISOString(),
  }
}

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const [detail, memberList, taskList, summary] = await Promise.all([
      getProject(projectId.value),
      listMembers(projectId.value),
      listTasks(projectId.value, taskPage.value, selectedTaskFilter()),
      getTaskStats(projectId.value),
    ])
    project.value = detail
    members.value = memberList
    tasks.value = taskList.items
    taskTotal.value = taskList.total
    stats.value = summary
    if (detail.ownerId === auth.user?.id) {
      const result = await listAudit(projectId.value, auditPage.value, selectedAuditFilter())
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

async function applyTaskFilter(): Promise<void> {
  taskPage.value = 1
  await load()
}

async function clearTaskFilter(): Promise<void> {
  taskStatus.value = ''
  taskPriority.value = ''
  taskAssignee.value = ''
  await applyTaskFilter()
}

async function applyAuditFilter(): Promise<void> {
  auditPage.value = 1
  await load()
}

async function clearAuditFilter(): Promise<void> {
  auditActor.value = ''
  auditAction.value = ''
  auditFrom.value = null
  auditTo.value = null
  await applyAuditFilter()
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
      dueAt: newTaskDueAt.value?.toISOString(),
    })
    taskDialogOpen.value = false
    newTaskTitle.value = ''
    newTaskDescription.value = ''
    newTaskAssignee.value = ''
    newTaskDueAt.value = null
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
  taskStatus.value = ''
  taskPriority.value = ''
  taskAssignee.value = ''
  auditActor.value = ''
  auditAction.value = ''
  auditFrom.value = null
  auditTo.value = null
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
        <el-button @click="router.push({ name: 'project-dashboard', params: { id: projectId } })"
          >统计详情</el-button
        >
        <el-button v-if="isOwner && isActive" @click="archive">归档项目</el-button>
        <el-button v-if="isActive" type="primary" @click="taskDialogOpen = true"
          >创建任务</el-button
        >
      </div>
    </header>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-card v-if="stats" class="section">
      <template #header>项目统计</template>
      <div class="stats-grid">
        <el-statistic title="总任务" :value="stats.total" />
        <el-statistic title="待开始" :value="stats.todo" />
        <el-statistic title="进行中" :value="stats.inProgress" />
        <el-statistic title="待评审" :value="stats.inReview" />
        <el-statistic title="已完成" :value="stats.done" />
        <el-statistic title="已逾期" :value="stats.overdue" />
      </div>
      <p>完成率 {{ stats.completionRatePercent }}%</p>
      <el-progress :percentage="stats.completionRatePercent" :show-text="false" />
    </el-card>
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
      <div class="filter-row">
        <el-select v-model="taskStatus" clearable placeholder="全部状态">
          <el-option label="待开始" value="TODO" />
          <el-option label="进行中" value="IN_PROGRESS" />
          <el-option label="待评审" value="IN_REVIEW" />
          <el-option label="已完成" value="DONE" />
        </el-select>
        <el-select v-model="taskPriority" clearable placeholder="全部优先级">
          <el-option label="低" value="LOW" />
          <el-option label="中" value="MEDIUM" />
          <el-option label="高" value="HIGH" />
        </el-select>
        <el-select v-model="taskAssignee" clearable placeholder="全部负责人">
          <el-option
            v-for="member in members"
            :key="member.userId"
            :label="member.displayName"
            :value="member.userId"
          />
        </el-select>
        <el-button type="primary" @click="applyTaskFilter">筛选任务</el-button>
        <el-button @click="clearTaskFilter">清空</el-button>
      </div>
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
      <div class="filter-row">
        <el-input v-model="auditActor" clearable placeholder="操作人 ID（可含已移除成员）" />
        <el-select v-model="auditAction" clearable placeholder="全部操作">
          <el-option label="创建项目" value="PROJECT_CREATED" />
          <el-option label="修改项目" value="PROJECT_UPDATED" />
          <el-option label="归档项目" value="PROJECT_ARCHIVED" />
          <el-option label="添加成员" value="MEMBER_ADDED" />
          <el-option label="移除成员" value="MEMBER_REMOVED" />
          <el-option label="创建任务" value="TASK_CREATED" />
          <el-option label="编辑任务" value="TASK_UPDATED" />
          <el-option label="状态流转" value="TASK_STATUS_CHANGED" />
        </el-select>
        <el-date-picker v-model="auditFrom" type="datetime" placeholder="开始时间" />
        <el-date-picker v-model="auditTo" type="datetime" placeholder="结束时间（不含）" />
        <el-button type="primary" @click="applyAuditFilter">筛选审计</el-button>
        <el-button @click="clearAuditFilter">清空</el-button>
      </div>
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
    <el-dialog v-model="taskDialogOpen" title="创建任务" width="min(520px, 92vw)">
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
        <el-form-item label="截止时间"
          ><el-date-picker v-model="newTaskDueAt" type="datetime" placeholder="可选"
        /></el-form-item>
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
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.filter-row .el-select {
  width: 150px;
}
.filter-row .el-input {
  width: 220px;
}
.pager {
  margin-top: 20px;
  justify-content: flex-end;
  flex-wrap: wrap;
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
  .inline-form {
    flex-direction: column;
  }
  .filter-row .el-select,
  .filter-row .el-input {
    width: 100%;
  }
}
</style>

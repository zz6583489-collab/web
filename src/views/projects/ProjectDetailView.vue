<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { ApiError, formatApiError } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import TaskDrawer from '../tasks/TaskDrawer.vue'
import {
  createTask,
  getTaskStats,
  listAudit,
  listTasks,
  type AuditFilter,
  type AuditView,
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
  updateProject,
  type MemberView,
  type ProjectView,
} from './projectApi'

type ProjectTab = 'board' | 'members' | 'audit'
const STATUS_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: '待处理' },
  { status: 'IN_PROGRESS', label: '进行中' },
  { status: 'IN_REVIEW', label: '待评审' },
  { status: 'DONE', label: '已完成' },
]
const AUDIT_ACTIONS = [
  { value: 'PROJECT_CREATED', label: '创建项目' },
  { value: 'PROJECT_UPDATED', label: '修改项目' },
  { value: 'PROJECT_ARCHIVED', label: '归档项目' },
  { value: 'MEMBER_ADDED', label: '添加成员' },
  { value: 'MEMBER_REMOVED', label: '移除成员' },
  { value: 'TASK_CREATED', label: '创建任务' },
  { value: 'TASK_UPDATED', label: '编辑任务' },
  { value: 'TASK_STATUS_CHANGED', label: '状态流转' },
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projectId = computed(() => String(route.params.id))
const project = ref<ProjectView | null>(null)
const members = ref<MemberView[]>([])
const tasks = ref<TaskView[]>([])
const stats = ref<TaskStats | null>(null)
const audit = ref<AuditView[]>([])
const activeTab = ref<ProjectTab>('board')
const unavailable = ref(false)
const loading = ref(false)
const taskLoading = ref(false)
const auditLoading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const taskError = ref('')
const memberError = ref('')
const auditError = ref('')
const taskDialogError = ref('')
const memberDialogError = ref('')
const settingsError = ref('')
const taskPage = ref(1)
const taskTotal = ref(0)
const auditPage = ref(1)
const auditTotal = ref(0)
const taskStatus = ref<TaskStatus | ''>('')
const taskPriority = ref<TaskPriority | ''>('')
const taskAssignee = ref('')
const auditActor = ref('')
const auditAction = ref('')
const auditFrom = ref<Date | null>(null)
const auditTo = ref<Date | null>(null)
const taskDialogOpen = ref(false)
const memberDialogOpen = ref(false)
const settingsOpen = ref(false)
const drawerOpen = ref(false)
const selectedTaskId = ref<string | null>(null)
const newMemberId = ref('')
const newTaskTitle = ref('')
const newTaskDescription = ref('')
const newTaskAssignee = ref('')
const newTaskPriority = ref<TaskPriority>('MEDIUM')
const newTaskDueAt = ref<Date | null>(null)
const editProjectName = ref('')
const editProjectDescription = ref('')
let loadSequence = 0
let taskLoadSequence = 0
let auditLoadSequence = 0

const isOwner = computed(() => project.value?.ownerId === auth.user?.id)
const isActive = computed(() => project.value?.status === 'ACTIVE')
const columns = computed(() =>
  STATUS_COLUMNS.map((column) => ({
    ...column,
    items: tasks.value.filter((task) => task.status === column.status),
  })),
)

function memberName(id: string | null): string {
  if (!id) return '未指派'
  return members.value.find((member) => member.userId === id)?.displayName || '用户 ' + id
}

function avatar(name: string): string {
  return name.slice(0, 1) || '成'
}

function shortDate(value: string | null): string {
  if (!value) return '无截止时间'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '时间未知'
    : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date)
}

function statusClass(status: TaskStatus): string {
  return status === 'TODO'
    ? 'todo'
    : status === 'IN_PROGRESS'
      ? 'in-progress'
      : status === 'IN_REVIEW'
        ? 'in-review'
        : 'done'
}

function priorityClass(priority: TaskPriority): string {
  return priority.toLowerCase()
}

function priorityLabel(priority: TaskPriority): string {
  return priority === 'HIGH' ? '高优先级' : priority === 'MEDIUM' ? '中优先级' : '低优先级'
}

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

async function loadTasks(nextPage = taskPage.value): Promise<void> {
  const sequence = ++taskLoadSequence
  const id = projectId.value
  taskLoading.value = true
  taskError.value = ''
  try {
    const result = await listTasks(id, nextPage, selectedTaskFilter())
    if (sequence !== taskLoadSequence || id !== projectId.value) return
    tasks.value = result.items
    taskTotal.value = result.total
    taskPage.value = result.page
  } catch (error) {
    if (sequence === taskLoadSequence) taskError.value = formatApiError(error)
  } finally {
    if (sequence === taskLoadSequence) taskLoading.value = false
  }
}

async function loadAudit(nextPage = auditPage.value): Promise<void> {
  if (!isOwner.value) return
  const sequence = ++auditLoadSequence
  const id = projectId.value
  auditLoading.value = true
  auditError.value = ''
  try {
    const result = await listAudit(id, nextPage, selectedAuditFilter())
    if (sequence !== auditLoadSequence || id !== projectId.value) return
    audit.value = result.items
    auditTotal.value = result.total
    auditPage.value = result.page
  } catch (error) {
    if (sequence === auditLoadSequence) auditError.value = formatApiError(error)
  } finally {
    if (sequence === auditLoadSequence) auditLoading.value = false
  }
}

async function refreshSummary(): Promise<void> {
  try {
    stats.value = await getTaskStats(projectId.value)
  } catch (error) {
    errorMessage.value = formatApiError(error)
  }
}

async function loadProject(): Promise<void> {
  const sequence = ++loadSequence
  const id = projectId.value
  loading.value = true
  unavailable.value = false
  errorMessage.value = ''
  try {
    const detail = await getProject(id)
    const [memberList, summary] = await Promise.all([listMembers(id), getTaskStats(id)])
    if (sequence !== loadSequence) return
    project.value = detail
    members.value = memberList
    stats.value = summary
    if (!isOwner.value) {
      audit.value = []
      if (activeTab.value === 'audit') activeTab.value = 'board'
    }
    await Promise.all([loadTasks(1), isOwner.value ? loadAudit(1) : Promise.resolve()])
    const targetTaskId = route.query.taskId
    if (typeof targetTaskId === 'string' && /^[1-9][0-9]*$/.test(targetTaskId)) {
      openTask(targetTaskId)
    }
  } catch (error) {
    if (sequence !== loadSequence) return
    taskLoadSequence += 1
    auditLoadSequence += 1
    taskLoading.value = false
    auditLoading.value = false
    project.value = null
    members.value = []
    tasks.value = []
    stats.value = null
    audit.value = []
    selectedTaskId.value = null
    drawerOpen.value = false
    if (error instanceof ApiError && error.code === 'PROJECT.NOT_FOUND') unavailable.value = true
    else errorMessage.value = formatApiError(error)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function applyTaskFilter(): Promise<void> {
  await loadTasks(1)
}

async function clearTaskFilter(): Promise<void> {
  taskStatus.value = ''
  taskPriority.value = ''
  taskAssignee.value = ''
  await loadTasks(1)
}

async function clearAuditFilter(): Promise<void> {
  auditActor.value = ''
  auditAction.value = ''
  auditFrom.value = null
  auditTo.value = null
  await loadAudit(1)
}

async function submitMember(): Promise<void> {
  const userId = newMemberId.value.trim()
  if (!/^[1-9][0-9]*$/.test(userId)) {
    memberDialogError.value = '请输入有效的用户 ID'
    return
  }
  submitting.value = true
  memberDialogError.value = ''
  try {
    await addMember(projectId.value, userId)
    members.value = await listMembers(projectId.value)
    memberDialogOpen.value = false
    newMemberId.value = ''
    if (isOwner.value) await loadAudit()
  } catch (error) {
    memberDialogError.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

async function remove(userId: string): Promise<void> {
  const member = members.value.find((entry) => entry.userId === userId)
  if (!member) return
  memberError.value = ''
  try {
    await ElMessageBox.confirm(
      '仍被任何任务指派的成员需要先重新分配任务。确认移除 ' + member.displayName + ' 吗？',
      '移除项目成员',
      { confirmButtonText: '确认移除', cancelButtonText: '取消', type: 'warning' },
    )
    await removeMember(projectId.value, userId)
    members.value = await listMembers(projectId.value)
    if (isOwner.value) await loadAudit()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    memberError.value =
      error instanceof ApiError && error.code === 'PROJECT.MEMBER_HAS_TASKS'
        ? '该成员仍负责任务，请先在任务看板重新指派。' +
          (error.traceId ? ' TraceId：' + error.traceId : '')
        : formatApiError(error)
  }
}

function resetTaskForm(): void {
  newTaskTitle.value = ''
  newTaskDescription.value = ''
  newTaskAssignee.value = ''
  newTaskPriority.value = 'MEDIUM'
  newTaskDueAt.value = null
  taskDialogError.value = ''
}

async function submitTask(): Promise<void> {
  if (!newTaskTitle.value.trim()) {
    taskDialogError.value = '请输入任务标题'
    return
  }
  submitting.value = true
  taskDialogError.value = ''
  try {
    await createTask(projectId.value, {
      title: newTaskTitle.value.trim(),
      description: newTaskDescription.value.trim(),
      assigneeId: newTaskAssignee.value || undefined,
      priority: newTaskPriority.value,
      dueAt: newTaskDueAt.value?.toISOString(),
    })
    taskDialogOpen.value = false
    resetTaskForm()
    await Promise.all([loadTasks(1), refreshSummary(), loadAudit()])
  } catch (error) {
    taskDialogError.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

function openSettings(): void {
  if (!project.value) return
  editProjectName.value = project.value.name
  editProjectDescription.value = project.value.description ?? ''
  settingsError.value = ''
  settingsOpen.value = true
}

async function saveSettings(): Promise<void> {
  const current = project.value
  if (!current) return
  if (!editProjectName.value.trim()) {
    settingsError.value = '请输入项目名称'
    return
  }
  submitting.value = true
  settingsError.value = ''
  try {
    project.value = await updateProject(current.id, {
      name: editProjectName.value.trim(),
      description: editProjectDescription.value.trim(),
    })
    settingsOpen.value = false
    await loadAudit()
  } catch (error) {
    settingsError.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

async function archive(): Promise<void> {
  if (!isOwner.value || !isActive.value) return
  settingsError.value = ''
  try {
    await ElMessageBox.confirm(
      '归档后项目、成员和任务均只读，历史与审计记录仍可查看。确定归档吗？',
      '归档项目',
      { confirmButtonText: '确认归档', cancelButtonText: '再检查一下', type: 'warning' },
    )
    await archiveProject(projectId.value)
    settingsOpen.value = false
    await loadProject()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    settingsError.value = formatApiError(error)
  }
}

function openTask(id: string): void {
  selectedTaskId.value = id
  drawerOpen.value = true
}

async function refreshAfterTask(): Promise<void> {
  await Promise.all([loadTasks(), refreshSummary(), loadAudit()])
}

onMounted(() => {
  void loadProject()
})
watch(projectId, () => {
  taskLoadSequence += 1
  auditLoadSequence += 1
  taskLoading.value = false
  auditLoading.value = false
  activeTab.value = 'board'
  taskPage.value = 1
  auditPage.value = 1
  selectedTaskId.value = null
  drawerOpen.value = false
  void loadProject()
})
watch(
  () => route.query.taskId,
  (targetTaskId) => {
    if (
      typeof targetTaskId === 'string' &&
      /^[1-9][0-9]*$/.test(targetTaskId) &&
      project.value &&
      !unavailable.value
    ) {
      activeTab.value = 'board'
      openTask(targetTaskId)
    }
  },
)
watch(drawerOpen, (value) => {
  if (!value && route.query.taskId) {
    const query = { ...route.query }
    delete query.taskId
    void router.replace({ query })
  }
})
</script>

<template>
  <main v-loading="loading" class="tf-page project-detail">
    <div v-if="unavailable" class="tf-empty unavailable-state">
      <span class="tf-empty-symbol">◇</span><span class="tf-eyebrow">PROJECT.NOT_FOUND · 404</span>
      <h2>项目无法访问</h2>
      <p>项目可能不存在，或你已经不在该项目中。请返回项目空间查看当前可访问的项目。</p>
      <el-button type="primary" @click="router.push({ name: 'home' })">返回项目空间 →</el-button>
    </div>
    <el-alert
      v-else-if="errorMessage && !project"
      class="tf-error-alert"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />
    <template v-else-if="project">
      <header class="project-header">
        <div class="project-breadcrumb">
          <RouterLink :to="{ name: 'home' }">项目空间</RouterLink><span>›</span
          ><strong>{{ project.name }}</strong>
        </div>
        <div class="project-title-row">
          <span class="project-mark">{{ project.name.slice(0, 1) }}</span>
          <div class="project-title">
            <div>
              <h1>{{ project.name }}</h1>
              <span class="tf-status" :class="isActive ? 'active' : 'archived'">{{
                isActive ? '● 进行中' : '已归档'
              }}</span>
            </div>
            <p>{{ project.description || '暂无项目说明' }}</p>
          </div>
          <div class="project-actions">
            <div class="member-avatars" aria-label="项目成员">
              <span
                v-for="member in members.slice(0, 3)"
                :key="member.userId"
                class="tf-avatar"
                :title="member.displayName"
                >{{ avatar(member.displayName) }}</span
              ><span v-if="members.length > 3" class="tf-avatar">+{{ members.length - 3 }}</span>
            </div>
            <el-button v-if="isOwner && isActive" aria-label="项目设置" @click="openSettings"
              >⋯</el-button
            ><el-button v-if="isActive" type="primary" @click="taskDialogOpen = true"
              >＋ 新建任务</el-button
            >
          </div>
        </div>
      </header>
      <nav class="project-tabs" aria-label="项目内容">
        <button
          type="button"
          :class="{ active: activeTab === 'board' }"
          @click="activeTab = 'board'"
        >
          任务看板
        </button>
        <button
          type="button"
          :class="{ active: activeTab === 'members' }"
          @click="activeTab = 'members'"
        >
          项目成员 <span>{{ members.length }}</span>
        </button>
        <button
          v-if="isOwner"
          type="button"
          :class="{ active: activeTab === 'audit' }"
          @click="activeTab = 'audit'"
        >
          操作审计
        </button>
      </nav>
      <el-alert
        v-if="errorMessage"
        class="tf-error-alert project-level-error"
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon
      />
      <div v-if="!isActive" class="tf-hint-panel archived-banner">
        <span class="tf-hint-icon">i</span>
        <div>
          <strong>项目已归档，当前内容只读</strong>
          <p>成员、任务和项目资料不能再修改；历史与审计仍可查看。</p>
        </div>
      </div>

      <section v-if="activeTab === 'board'" class="project-section">
        <div class="tf-section-heading">
          <div>
            <h2>
              任务看板 <span class="tf-count-chip">{{ taskTotal }}</span>
            </h2>
            <p>按状态查看项目进展，点击任务了解细节。</p>
          </div>
          <el-button @click="router.push({ name: 'project-dashboard', params: { id: projectId } })"
            >查看项目统计</el-button
          >
        </div>
        <div class="board-filters">
          <el-select v-model="taskStatus" clearable placeholder="全部状态"
            ><el-option label="待处理" value="TODO" /><el-option
              label="进行中"
              value="IN_PROGRESS" /><el-option label="待评审" value="IN_REVIEW" /><el-option
              label="已完成"
              value="DONE"
          /></el-select>
          <el-select v-model="taskPriority" clearable placeholder="全部优先级"
            ><el-option label="低优先级" value="LOW" /><el-option
              label="中优先级"
              value="MEDIUM" /><el-option label="高优先级" value="HIGH"
          /></el-select>
          <el-select v-model="taskAssignee" clearable placeholder="全部负责人"
            ><el-option
              v-for="member in members"
              :key="member.userId"
              :label="member.displayName"
              :value="member.userId"
          /></el-select>
          <el-button type="primary" @click="applyTaskFilter">筛选任务</el-button
          ><el-button @click="clearTaskFilter">清空</el-button>
        </div>
        <el-alert
          v-if="taskError"
          class="tf-error-alert"
          :title="taskError"
          type="error"
          :closable="false"
        />
        <div v-loading="taskLoading" class="board-grid">
          <section
            v-for="column in columns"
            :key="column.status"
            class="board-column"
            :aria-label="column.label"
          >
            <h3>
              <i :class="statusClass(column.status)" />{{ column.label }}
              <span>{{ column.items.length }}</span>
            </h3>
            <button
              v-for="task in column.items"
              :key="task.id"
              class="task-card"
              type="button"
              @click="openTask(task.id)"
            >
              <span class="task-card-meta"
                ><span class="tf-priority" :class="priorityClass(task.priority)"
                  >● {{ priorityLabel(task.priority) }}</span
                ><small>TF-{{ task.id }}</small></span
              >
              <strong>{{ task.title }}</strong
              ><span class="task-card-description">{{ task.description || '暂无任务说明' }}</span>
              <span class="task-card-footer"
                ><span>{{ shortDate(task.dueAt) }}</span
                ><span class="tf-avatar" :title="memberName(task.assigneeId)">{{
                  avatar(memberName(task.assigneeId))
                }}</span></span
              >
            </button>
            <p v-if="column.items.length === 0" class="board-column-empty">当前页暂无任务</p>
          </section>
        </div>
        <el-pagination
          v-if="taskTotal > 20"
          class="tf-pager"
          layout="prev, pager, next, total"
          :current-page="taskPage"
          :page-size="20"
          :total="taskTotal"
          @current-change="loadTasks"
        />
        <p class="tf-hint">看板显示当前筛选页。任务状态由服务端校验，更新需携带版本号。</p>
      </section>

      <section v-else-if="activeTab === 'members'" class="project-section">
        <div class="tf-section-heading">
          <div>
            <h2>
              项目成员 <span class="tf-count-chip">{{ members.length }}</span>
            </h2>
            <p>项目负责人可以添加或移除成员。已被任务指派的成员需先重新分配任务。</p>
          </div>
          <el-button v-if="isOwner && isActive" type="primary" @click="memberDialogOpen = true"
            >＋ 添加成员</el-button
          >
        </div>
        <el-alert
          v-if="memberError"
          class="tf-error-alert"
          :title="memberError"
          type="error"
          :closable="false"
          show-icon
        />
        <div class="tf-surface member-table">
          <el-table :data="members" empty-text="暂无成员"
            ><el-table-column label="成员" min-width="240"
              ><template #default="scope"
                ><div class="member-person">
                  <span class="tf-avatar">{{ avatar(scope.row.displayName) }}</span
                  ><span
                    ><strong>{{ scope.row.displayName }}</strong
                    ><small>{{ scope.row.username }} · ID {{ scope.row.userId }}</small></span
                  >
                </div></template
              ></el-table-column
            ><el-table-column label="项目角色" min-width="140"
              ><template #default="scope"
                ><span class="member-role" :class="{ owner: scope.row.role === 'OWNER' }">{{
                  scope.row.role
                }}</span></template
              ></el-table-column
            ><el-table-column label="加入时间" min-width="150"
              ><template #default="scope">{{
                shortDate(scope.row.joinedAt)
              }}</template></el-table-column
            ><el-table-column label="操作" width="110"
              ><template #default="scope"
                ><span v-if="scope.row.role === 'OWNER'" class="protected-note">不可移除</span
                ><el-button
                  v-else-if="isOwner && isActive"
                  link
                  type="danger"
                  @click="remove(scope.row.userId)"
                  >移除</el-button
                ><span v-else class="protected-note">—</span></template
              ></el-table-column
            ></el-table
          >
        </div>
        <div class="tf-hint-panel member-help">
          <span class="tf-hint-icon">i</span>
          <div>
            <strong>移除成员前的提醒</strong>
            <p>只要仍被任何任务指派，系统就会拒绝移除；项目 OWNER 始终保留成员身份。</p>
          </div>
        </div>
      </section>

      <section v-else class="project-section">
        <div class="tf-section-heading">
          <div>
            <h2>操作审计</h2>
            <p>关键项目操作有完整记录，便于回溯决策与定位问题。</p>
          </div>
          <span class="tf-hint">仅项目负责人可见</span>
        </div>
        <div class="tf-hint-panel audit-intro">
          <span class="tf-hint-icon">✓</span>
          <div>
            <strong>记录完整，追踪清晰</strong>
            <p>审计信息只包含必要的操作元数据，时间与 TraceId 可用于排查。</p>
          </div>
        </div>
        <div class="audit-filters">
          <el-input v-model="auditActor" clearable placeholder="操作人 ID" /><el-select
            v-model="auditAction"
            clearable
            placeholder="全部操作"
            ><el-option
              v-for="action in AUDIT_ACTIONS"
              :key="action.value"
              :label="action.label"
              :value="action.value" /></el-select
          ><el-date-picker
            v-model="auditFrom"
            type="datetime"
            placeholder="开始时间"
          /><el-date-picker
            v-model="auditTo"
            type="datetime"
            placeholder="结束时间（不含）"
          /><el-button type="primary" @click="loadAudit(1)">筛选</el-button
          ><el-button @click="clearAuditFilter">清空</el-button>
        </div>
        <el-alert
          v-if="auditError"
          class="tf-error-alert"
          :title="auditError"
          type="error"
          :closable="false"
        />
        <div v-loading="auditLoading" class="tf-surface audit-table">
          <el-table :data="audit" empty-text="暂无审计记录"
            ><el-table-column label="操作" min-width="160"
              ><template #default="scope"
                ><strong>{{
                  AUDIT_ACTIONS.find((action) => action.value === scope.row.action)?.label ||
                  scope.row.action
                }}</strong></template
              ></el-table-column
            ><el-table-column label="对象 / 操作人" min-width="220"
              ><template #default="scope"
                >{{ scope.row.resourceType }} {{ scope.row.resourceId || '' }} · 用户
                {{ scope.row.actorId }}</template
              ></el-table-column
            ><el-table-column prop="createdAt" label="发生时间" min-width="190" /><el-table-column
              prop="traceId"
              label="TraceId"
              min-width="270"
          /></el-table>
        </div>
        <el-pagination
          v-if="auditTotal > 20"
          class="tf-pager"
          layout="prev, pager, next, total"
          :current-page="auditPage"
          :page-size="20"
          :total="auditTotal"
          @current-change="loadAudit"
        />
        <p class="tf-hint">审计信息不展示密码、令牌或请求正文。</p>
      </section>
    </template>

    <el-dialog v-model="taskDialogOpen" title="创建任务" width="640" @closed="resetTaskForm">
      <template #header
        ><div class="tf-dialog-heading">
          <span>NEW TASK · {{ project?.name }}</span
          ><strong>创建任务</strong><small>写清交付目标，再设置负责人和时间。</small>
        </div></template
      >
      <el-form label-position="top" @submit.prevent="submitTask">
        <el-form-item label="任务标题"
          ><el-input
            v-model="newTaskTitle"
            maxlength="200"
            show-word-limit
            placeholder="输入任务标题"
        /></el-form-item>
        <el-form-item label="任务描述"
          ><el-input
            v-model="newTaskDescription"
            type="textarea"
            maxlength="10000"
            :rows="3"
            placeholder="说明交付目标（可选）"
        /></el-form-item>
        <div class="dialog-form-grid">
          <el-form-item label="负责人"
            ><el-select v-model="newTaskAssignee" clearable placeholder="可稍后指派"
              ><el-option
                v-for="member in members"
                :key="member.userId"
                :label="member.displayName"
                :value="member.userId" /></el-select></el-form-item
          ><el-form-item label="优先级"
            ><el-select v-model="newTaskPriority"
              ><el-option label="低优先级" value="LOW" /><el-option
                label="中优先级"
                value="MEDIUM" /><el-option label="高优先级" value="HIGH" /></el-select
          ></el-form-item>
        </div>
        <el-form-item label="截止时间"
          ><el-date-picker v-model="newTaskDueAt" type="datetime" placeholder="可选"
        /></el-form-item>
        <div class="tf-hint-panel">
          <span class="tf-hint-icon">i</span>
          <div>
            <strong>负责人必须是当前项目成员</strong>
            <p>新任务从「待处理」开始；创建后可在任务详情中推进状态。</p>
          </div>
        </div>
        <el-alert
          v-if="taskDialogError"
          class="tf-error-alert dialog-error"
          :title="taskDialogError"
          type="error"
          :closable="false"
        />
      </el-form>
      <template #footer
        ><div class="tf-dialog-footer">
          <span>项目归档后不能创建任务。</span>
          <div>
            <el-button @click="taskDialogOpen = false">取消</el-button
            ><el-button type="primary" :loading="submitting" @click="submitTask"
              >创建任务 →</el-button
            >
          </div>
        </div></template
      >
    </el-dialog>

    <el-dialog v-model="memberDialogOpen" title="添加项目成员" width="550">
      <template #header
        ><div class="tf-dialog-heading">
          <span>PROJECT MEMBERS · OWNER</span><strong>添加项目成员</strong
          ><small>输入现有账号的用户 ID，加入 {{ project?.name }}。</small>
        </div></template
      >
      <el-form label-position="top" @submit.prevent="submitMember"
        ><el-form-item label="用户 ID"
          ><el-input
            v-model="newMemberId"
            inputmode="numeric"
            placeholder="输入已创建账号的用户 ID"
        /></el-form-item>
        <p class="tf-hint">请向系统管理员确认账号 ID；当前接口不提供用户搜索。</p>
        <div class="tf-hint-panel">
          <span class="tf-hint-icon">i</span>
          <div>
            <strong>加入后即可查看当前项目</strong>
            <p>仅添加 MEMBER；系统管理员身份不会自动授予项目访问权。</p>
          </div>
        </div>
        <el-alert
          v-if="memberDialogError"
          class="tf-error-alert dialog-error"
          :title="memberDialogError"
          type="error"
          :closable="false"
      /></el-form>
      <template #footer
        ><div class="tf-dialog-footer">
          <span>仅项目 OWNER 可执行此操作。</span>
          <div>
            <el-button @click="memberDialogOpen = false">取消</el-button
            ><el-button type="primary" :loading="submitting" @click="submitMember"
              >添加成员</el-button
            >
          </div>
        </div></template
      >
    </el-dialog>

    <el-drawer v-model="settingsOpen" title="项目设置" size="600px">
      <template #header
        ><div class="tf-dialog-heading">
          <span>PROJECT SETTINGS · OWNER</span><strong>项目设置</strong
          ><small>调整项目信息并管理归档状态。</small>
        </div></template
      >
      <div v-if="project" class="settings-content">
        <div class="settings-project tf-hint-panel">
          <span class="project-mark small">{{ project.name.slice(0, 1) }}</span>
          <div>
            <strong>{{ project.name }}</strong>
            <p>项目 ID {{ project.id }} · {{ isActive ? '进行中' : '已归档' }}</p>
          </div>
        </div>
        <h3>基本信息</h3>
        <el-form label-position="top" @submit.prevent="saveSettings"
          ><el-form-item label="项目名称"
            ><el-input
              v-model="editProjectName"
              maxlength="160"
              show-word-limit
              :disabled="!isActive" /></el-form-item
          ><el-form-item label="项目描述"
            ><el-input
              v-model="editProjectDescription"
              type="textarea"
              maxlength="10000"
              :rows="3"
              :disabled="!isActive" /></el-form-item
        ></el-form>
        <div class="settings-danger">
          <h3>项目生命周期</h3>
          <div>
            <strong>归档项目</strong>
            <p>归档后项目、成员和任务均只读；历史与审计记录仍可查看。</p>
            <el-button v-if="isActive" type="danger" plain @click="archive">归档项目</el-button>
          </div>
        </div>
        <el-alert
          v-if="settingsError"
          class="tf-error-alert"
          :title="settingsError"
          type="error"
          :closable="false"
        />
      </div>
      <template #footer
        ><div class="tf-dialog-footer">
          <span>所有写入由服务端再次校验 OWNER 身份。</span>
          <div>
            <el-button @click="settingsOpen = false">取消</el-button
            ><el-button v-if="isActive" type="primary" :loading="submitting" @click="saveSettings"
              >保存修改</el-button
            >
          </div>
        </div></template
      >
    </el-drawer>
    <TaskDrawer
      v-model="drawerOpen"
      :task-id="selectedTaskId"
      :project-id="projectId"
      :members="members"
      :project-owner="isOwner"
      :project-active="isActive"
      :current-user-id="auth.user?.id ?? ''"
      @updated="refreshAfterTask"
    />
  </main>
</template>

<style scoped>
.project-detail {
  padding-top: 34px;
}
.project-header {
  margin-bottom: 0;
}
.project-breadcrumb {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 28px;
  color: #8b9ab1;
  font-size: 11px;
}
.project-breadcrumb strong {
  color: #476080;
}
.project-title-row {
  display: flex;
  align-items: center;
  gap: 18px;
}
.project-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 13px;
  background: #e7edff;
  color: #4169df;
  font-size: 20px;
  font-weight: 800;
}
.project-mark.small {
  width: 38px;
  height: 38px;
  font-size: 16px;
}
.project-title {
  min-width: 0;
}
.project-title > div {
  display: flex;
  align-items: center;
  gap: 14px;
}
.project-title h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.04em;
}
.project-title p {
  margin: 8px 0 0;
  color: var(--tf-muted);
  font-size: 11px;
}
.project-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.member-avatars {
  display: flex;
  padding-left: 8px;
}
.member-avatars .tf-avatar {
  margin-left: -8px;
  border: 2px solid #fff;
}
.project-tabs {
  display: flex;
  gap: 34px;
  margin-top: 29px;
  border-bottom: 1px solid var(--tf-line);
}
.project-tabs button {
  min-height: 43px;
  padding: 0 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: #7f8fa7;
  font-size: 12px;
}
.project-tabs button.active {
  border-bottom-color: var(--tf-brand);
  color: var(--tf-brand);
  font-weight: 700;
}
.project-tabs span {
  margin-left: 5px;
  color: #8ba1d5;
  font-size: 10px;
}
.project-level-error,
.archived-banner {
  margin-top: 18px;
}
.project-section {
  padding-top: 32px;
}
.board-filters,
.audit-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 20px;
}
.board-filters .el-select {
  width: 150px;
}
.audit-filters .el-input {
  width: 160px;
}
.audit-filters .el-select {
  width: 150px;
}
.audit-filters .el-date-editor {
  width: 195px;
}
.board-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(210px, 1fr));
  gap: 18px;
  min-height: 220px;
}
.board-column {
  min-width: 0;
  padding: 14px;
  border-radius: 13px;
  background: #eff2f7;
}
.board-column h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 6px 2px 16px;
  font-size: 12px;
}
.board-column h3 i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #91a2bc;
}
.board-column h3 i.in-progress {
  background: #5b81ee;
}
.board-column h3 i.in-review {
  background: #d7a54b;
}
.board-column h3 i.done {
  background: #4caf92;
}
.board-column h3 span {
  color: #9caac0;
  font-size: 11px;
}
.task-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 160px;
  margin-bottom: 10px;
  padding: 13px;
  border: 1px solid var(--tf-line);
  border-radius: 11px;
  background: #fff;
  text-align: left;
  box-shadow: 0 1px 2px #23344b06;
}
.task-card:hover {
  border-color: #aac0fa;
}
.task-card-meta,
.task-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.task-card-meta small {
  color: #a4afc0;
  font-size: 10px;
}
.task-card > strong {
  margin: 14px 0 7px;
  font-size: 12px;
}
.task-card-description {
  display: -webkit-box;
  overflow: hidden;
  color: #8492a6;
  font-size: 10px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.task-card-footer {
  margin-top: auto;
  padding-top: 13px;
  border-top: 1px solid #edf1f6;
  color: #9baac0;
  font-size: 10px;
}
.task-card-footer .tf-avatar {
  width: 24px;
  height: 24px;
  font-size: 10px;
}
.board-column-empty {
  margin: 28px 4px;
  color: #9cabc0;
  font-size: 11px;
}
.member-table,
.audit-table {
  overflow-x: auto;
}
.member-table :deep(.el-table),
.audit-table :deep(.el-table) {
  min-width: 690px;
}
.member-person {
  display: flex;
  align-items: center;
  gap: 10px;
}
.member-person > span:last-child {
  display: grid;
  gap: 3px;
}
.member-person strong {
  font-size: 11px;
}
.member-person small,
.protected-note {
  color: #98a7ba;
  font-size: 10px;
}
.member-role {
  display: inline-block;
  padding: 6px 11px;
  border-radius: 7px;
  background: #f1f4f9;
  color: #7b8ba2;
  font-size: 10px;
  font-weight: 700;
}
.member-role.owner {
  background: #edf2ff;
  color: #486bd5;
}
.member-help {
  margin-top: 14px;
}
.audit-intro {
  margin-bottom: 16px;
}
.dialog-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.dialog-form-grid .el-select,
.dialog-form-grid .el-date-editor {
  width: 100%;
}
.dialog-error {
  margin-top: 14px;
}
.settings-content h3 {
  margin: 26px 0 18px;
  font-size: 14px;
}
.settings-project {
  align-items: center;
}
.settings-danger {
  margin-top: 28px;
  border-top: 1px solid var(--tf-line);
}
.settings-danger > div {
  position: relative;
  padding: 18px;
  border: 1px solid #f4d6da;
  border-radius: 11px;
  background: #fff8f8;
}
.settings-danger strong {
  color: #a43d4a;
  font-size: 12px;
}
.settings-danger p {
  max-width: 300px;
  margin: 7px 0 0;
  color: #a66c77;
  font-size: 10px;
  line-height: 1.5;
}
.settings-danger .el-button {
  position: absolute;
  top: 24px;
  right: 18px;
}
.unavailable-state {
  min-height: 70vh;
}
@media (max-width: 1100px) {
  .board-grid {
    grid-template-columns: repeat(2, minmax(210px, 1fr));
  }
}
@media (max-width: 767px) {
  .project-title-row {
    flex-wrap: wrap;
  }
  .project-title h1 {
    font-size: 23px;
  }
  .project-actions {
    width: 100%;
    margin-left: 0;
  }
  .project-actions .el-button:last-child {
    margin-left: auto;
  }
  .project-tabs {
    gap: 20px;
  }
  .board-grid {
    grid-template-columns: 1fr;
  }
  .board-filters .el-select,
  .audit-filters .el-input,
  .audit-filters .el-select,
  .audit-filters .el-date-editor {
    width: 100%;
  }
  .dialog-form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .settings-danger .el-button {
    position: static;
    margin-top: 12px;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ApiError, formatApiError } from '../../api/client'
import type { MemberView } from '../projects/projectApi'
import {
  editTask,
  getTask,
  listActivities,
  transitionTask,
  type ActivityView,
  type TaskPriority,
  type TaskStatus,
  type TaskView,
} from './taskApi'
import { availableTransitions } from './workflow'

const visible = defineModel<boolean>({ required: true })
const props = defineProps<{
  taskId: string | null
  projectId: string
  members: MemberView[]
  projectOwner: boolean
  projectActive: boolean
  currentUserId: string
}>()
const emit = defineEmits<{ updated: [] }>()
const task = ref<TaskView | null>(null)
const latestTask = ref<TaskView | null>(null)
const activities = ref<ActivityView[]>([])
const activityPage = ref(1)
const activityTotal = ref(0)
const title = ref('')
const description = ref('')
const priority = ref<TaskPriority>('MEDIUM')
const dueAt = ref<Date | null>(null)
const assigneeId = ref('')
const busy = ref(false)
const editing = ref(false)
const conflictOpen = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')
let loadSequence = 0

const isReporter = computed(() => task.value?.reporterId === props.currentUserId)
const isAssignee = computed(() => task.value?.assigneeId === props.currentUserId)
const canEditCore = computed(() => props.projectActive && (props.projectOwner || isReporter.value))
const canEditDescription = computed(
  () => props.projectActive && (props.projectOwner || isReporter.value || isAssignee.value),
)
const canEdit = computed(
  () =>
    canEditCore.value || canEditDescription.value || (props.projectOwner && props.projectActive),
)
const transitions = computed(() =>
  task.value && task.value.assigneeId && props.projectActive
    ? availableTransitions(task.value.status, props.projectOwner, isAssignee.value)
    : [],
)
const currentStep = computed(() =>
  task.value ? ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].indexOf(task.value.status) : -1,
)

function memberName(id: string | null): string {
  if (!id) return '未指派'
  return props.members.find((member) => member.userId === id)?.displayName || '用户 ' + id
}

function avatar(name: string): string {
  return name.slice(0, 1) || '成'
}

function dateLabel(value: string | null): string {
  if (!value) return '未设置'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '时间未知'
    : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(
        date,
      )
}

function statusLabel(status: TaskStatus): string {
  return status === 'TODO'
    ? '待处理'
    : status === 'IN_PROGRESS'
      ? '进行中'
      : status === 'IN_REVIEW'
        ? '待评审'
        : '已完成'
}

function priorityLabel(value: TaskPriority): string {
  return value === 'HIGH' ? '高优先级' : value === 'MEDIUM' ? '中优先级' : '低优先级'
}

function transitionLabel(toStatus: TaskStatus): string {
  if (toStatus === 'DONE') return '通过评审'
  if (toStatus === 'IN_REVIEW') return '提交评审'
  if (task.value?.status === 'IN_REVIEW') return '驳回并返回进行中'
  if (task.value?.status === 'DONE') return '重新打开任务'
  return '开始处理'
}

async function load(): Promise<void> {
  const id = props.taskId
  if (!id) return
  const sequence = ++loadSequence
  busy.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const detail = await getTask(id)
    if (sequence !== loadSequence || id !== props.taskId) return
    if (detail.projectId !== props.projectId) {
      task.value = null
      activities.value = []
      errorMessage.value = '任务无法访问'
      return
    }
    const history = await listActivities(id, activityPage.value)
    if (sequence !== loadSequence || id !== props.taskId) return
    task.value = detail
    activities.value = history.items
    activityTotal.value = history.total
    title.value = detail.title
    description.value = detail.description ?? ''
    priority.value = detail.priority
    dueAt.value = detail.dueAt ? new Date(detail.dueAt) : null
    assigneeId.value = detail.assigneeId ?? ''
  } catch (error) {
    if (sequence === loadSequence) errorMessage.value = formatApiError(error)
  } finally {
    if (sequence === loadSequence) busy.value = false
  }
}

async function inspectConflict(current: TaskView): Promise<void> {
  try {
    latestTask.value = await getTask(current.id)
    conflictOpen.value = true
  } catch (error) {
    errorMessage.value = formatApiError(error)
  }
}

function continueWithLatest(): void {
  if (!latestTask.value) return
  task.value = latestTask.value
  latestTask.value = null
  conflictOpen.value = false
  errorMessage.value = ''
  infoMessage.value = '已采用最新版本号，当前输入仍保留。请检查差异后再次保存。'
}

async function save(): Promise<void> {
  const current = task.value
  if (!current) return
  if (canEditCore.value && !title.value.trim()) {
    errorMessage.value = '请输入任务标题'
    return
  }
  const input: Parameters<typeof editTask>[1] = { version: current.version }
  if (canEditCore.value) {
    if (title.value.trim() !== current.title) input.title = title.value.trim()
    if (priority.value !== current.priority) input.priority = priority.value
    const beforeDue = current.dueAt ? new Date(current.dueAt).getTime() : null
    const afterDue = dueAt.value?.getTime() ?? null
    if (beforeDue !== afterDue) {
      if (dueAt.value) input.dueAt = dueAt.value.toISOString()
      else input.clearDueAt = true
    }
  }
  if (canEditDescription.value && description.value !== (current.description ?? '')) {
    input.description = description.value
  }
  if (props.projectOwner && assigneeId.value !== (current.assigneeId ?? '')) {
    if (assigneeId.value) input.assigneeId = assigneeId.value
    else input.unassign = true
  }
  if (Object.keys(input).length === 1) {
    infoMessage.value = '没有需要保存的修改'
    return
  }
  busy.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    await editTask(current.id, input)
    editing.value = false
    await load()
    emit('updated')
  } catch (error) {
    if (error instanceof ApiError && error.code === 'TASK.VERSION_CONFLICT') {
      await inspectConflict(current)
    } else {
      errorMessage.value = formatApiError(error)
    }
  } finally {
    busy.value = false
  }
}

async function move(toStatus: TaskStatus): Promise<void> {
  const current = task.value
  if (!current) return
  busy.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    await transitionTask(current.id, current.version, toStatus)
    await load()
    emit('updated')
  } catch (error) {
    if (error instanceof ApiError && error.code === 'TASK.VERSION_CONFLICT') {
      await inspectConflict(current)
    } else {
      errorMessage.value = formatApiError(error)
    }
  } finally {
    busy.value = false
  }
}

async function loadActivityPage(nextPage: number): Promise<void> {
  activityPage.value = nextPage
  await load()
}

watch(
  [visible, () => props.taskId],
  ([open, id]) => {
    if (open && id) {
      activityPage.value = 1
      task.value = null
      latestTask.value = null
      activities.value = []
      editing.value = false
      conflictOpen.value = false
      void load()
    } else {
      loadSequence += 1
      busy.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <el-drawer v-model="visible" title="任务详情" size="min(100%, 580px)" class="task-detail-drawer">
    <template #header
      ><div class="task-drawer-heading">
        <strong>{{ editing ? '编辑任务' : '任务详情' }}</strong
        ><span v-if="task">TF-{{ task.id }}</span>
      </div></template
    >
    <div v-loading="busy">
      <el-alert
        v-if="errorMessage"
        class="tf-error-alert"
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon
      />
      <el-alert
        v-if="infoMessage"
        class="tf-error-alert"
        :title="infoMessage"
        type="info"
        :closable="false"
      />
      <div v-if="task" class="task-drawer-body">
        <div class="task-detail-meta">
          <span class="tf-priority" :class="task.priority.toLowerCase()"
            >● {{ priorityLabel(task.priority) }}</span
          ><span>版本 v{{ task.version }}</span>
        </div>
        <template v-if="!editing">
          <h2>{{ task.title }}</h2>
          <p class="task-detail-description">{{ task.description || '暂无任务说明' }}</p>
          <section class="task-detail-section">
            <h3>任务进度</h3>
            <div class="task-steps">
              <div
                v-for="(status, index) in [
                  'TODO',
                  'IN_PROGRESS',
                  'IN_REVIEW',
                  'DONE',
                ] as TaskStatus[]"
                :key="status"
                :class="{ done: index < currentStep, current: index === currentStep }"
              >
                <i>{{ index < currentStep ? '✓' : index + 1 }}</i
                ><span>{{ statusLabel(status) }}</span>
              </div>
            </div>
          </section>
          <section class="task-detail-section">
            <h3>任务信息</h3>
            <dl class="task-detail-grid">
              <dt>负责人</dt>
              <dd>
                <span class="tf-avatar">{{ avatar(memberName(task.assigneeId)) }}</span
                >{{ memberName(task.assigneeId) }}
              </dd>
              <dt>创建人</dt>
              <dd>{{ memberName(task.reporterId) }}</dd>
              <dt>截止日期</dt>
              <dd>{{ dateLabel(task.dueAt) }}</dd>
              <dt>当前状态</dt>
              <dd>
                <span
                  class="tf-status"
                  :class="
                    task.status === 'TODO'
                      ? 'todo'
                      : task.status === 'IN_PROGRESS'
                        ? 'in-progress'
                        : task.status === 'IN_REVIEW'
                          ? 'in-review'
                          : 'done'
                  "
                  >{{ statusLabel(task.status) }}</span
                >
              </dd>
            </dl>
          </section>
          <section class="task-detail-section">
            <h3>活动记录</h3>
            <div v-if="activities.length" class="task-activities">
              <div v-for="activity in activities" :key="activity.id" class="task-activity">
                <span class="tf-avatar">{{ avatar(memberName(activity.actorId)) }}</span>
                <div>
                  <strong>{{ memberName(activity.actorId) }}</strong> {{ activity.action
                  }}<span v-if="activity.fromValue || activity.toValue"
                    >：{{ activity.fromValue || '—' }} → {{ activity.toValue || '—' }}</span
                  ><small>{{ dateLabel(activity.createdAt) }}</small>
                </div>
              </div>
            </div>
            <p v-else class="tf-hint">暂无活动记录</p>
            <el-pagination
              v-if="activityTotal > 20"
              class="tf-pager"
              layout="prev, pager, next, total"
              :current-page="activityPage"
              :page-size="20"
              :total="activityTotal"
              @current-change="loadActivityPage"
            />
          </section>
          <div v-if="!projectActive" class="tf-hint-panel">
            <span class="tf-hint-icon">i</span>
            <div>
              <strong>归档项目只读</strong>
              <p>任务资料与状态不能再修改。</p>
            </div>
          </div>
          <div class="task-action-bar">
            <el-button v-if="canEdit" @click="editing = true">编辑任务</el-button
            ><el-button
              v-for="status in transitions"
              :key="status"
              :type="status === 'DONE' || status === 'IN_REVIEW' ? 'primary' : 'default'"
              :loading="busy"
              @click="move(status)"
              >{{ transitionLabel(status) }}</el-button
            >
          </div>
        </template>
        <template v-else>
          <div class="tf-hint-panel task-edit-hint">
            <span class="tf-hint-icon">i</span>
            <div>
              <strong>按字段与项目身份授权</strong>
              <p>创建者、负责人和 OWNER 的可编辑字段不同，实际权限由服务端判断。</p>
            </div>
          </div>
          <el-form label-position="top" @submit.prevent="save"
            ><el-form-item label="任务标题"
              ><el-input
                v-model="title"
                :disabled="!canEditCore"
                maxlength="200"
                show-word-limit /></el-form-item
            ><el-form-item label="任务描述"
              ><el-input
                v-model="description"
                type="textarea"
                :disabled="!canEditDescription"
                maxlength="10000"
                :rows="4" /></el-form-item
            ><el-form-item label="负责人"
              ><el-select
                v-model="assigneeId"
                clearable
                :disabled="!projectOwner || !projectActive"
                placeholder="未指派"
                ><el-option
                  v-for="member in members"
                  :key="member.userId"
                  :label="member.displayName"
                  :value="member.userId" /></el-select></el-form-item
            ><el-form-item label="优先级"
              ><el-select v-model="priority" :disabled="!canEditCore"
                ><el-option label="低优先级" value="LOW" /><el-option
                  label="中优先级"
                  value="MEDIUM" /><el-option
                  label="高优先级"
                  value="HIGH" /></el-select></el-form-item
            ><el-form-item label="截止时间"
              ><el-date-picker
                v-model="dueAt"
                type="datetime"
                :disabled="!canEditCore"
                placeholder="无截止时间" /></el-form-item
          ></el-form>
          <div class="tf-hint-panel">
            <span class="tf-hint-icon">i</span>
            <div>
              <strong>并发编辑保护</strong>
              <p>保存时提交版本 v{{ task.version }}。若任务已更新，当前输入会保留。</p>
            </div>
          </div>
          <div class="task-action-bar">
            <el-button @click="editing = false">取消</el-button
            ><el-button type="primary" :loading="busy" @click="save">保存修改</el-button>
          </div>
        </template>
      </div>
    </div>
  </el-drawer>

  <el-dialog v-model="conflictOpen" title="任务版本冲突" width="560">
    <template #header
      ><div class="tf-dialog-heading">
        <span class="conflict-kicker">TASK.VERSION_CONFLICT · 409</span
        ><strong>任务已被其他成员更新</strong
        ><small>当前编辑仍保留，请先查看最新版本再决定如何处理。</small>
      </div></template
    >
    <div class="conflict-versions">
      <div>
        <small>你正在编辑</small><strong>版本 v{{ task?.version }}</strong>
        <p>当前输入尚未提交</p>
      </div>
      <span>→</span>
      <div>
        <small>服务器当前版本</small><strong>版本 v{{ latestTask?.version }}</strong>
        <p>更新于 {{ dateLabel(latestTask?.updatedAt ?? null) }}</p>
      </div>
    </div>
    <div class="tf-hint-panel">
      <span class="tf-hint-icon">i</span>
      <div>
        <strong>先检查差异，再重新保存</strong>
        <p>采用最新版本号不会覆盖你刚才输入的内容。</p>
      </div>
    </div>
    <template #footer
      ><div class="tf-dialog-footer">
        <span>任务写入需要提交当前 version。</span>
        <div>
          <el-button @click="conflictOpen = false">返回编辑</el-button
          ><el-button type="primary" @click="continueWithLatest">以最新版本继续编辑</el-button>
        </div>
      </div></template
    >
  </el-dialog>
</template>

<style scoped>
.task-drawer-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.task-drawer-heading strong {
  font-size: 15px;
}
.task-drawer-heading span {
  color: #91a5c1;
  font-size: 11px;
}
.task-detail-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  color: #8b9ab1;
  font-size: 10px;
}
.task-drawer-body h2 {
  margin: 0 0 14px;
  font-size: 22px;
}
.task-detail-description {
  margin: 0 0 26px;
  color: #7387a8;
  font-size: 12px;
  line-height: 1.7;
}
.task-detail-section {
  padding: 25px 0;
  border-top: 1px solid var(--tf-line);
}
.task-detail-section h3 {
  margin: 0 0 22px;
  font-size: 14px;
}
.task-steps {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.task-steps > div {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-width: 54px;
  color: #a2aec0;
  font-size: 10px;
}
.task-steps i {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: #edf1f6;
  font-size: 11px;
  font-style: normal;
}
.task-steps .done i {
  background: #e0f5ec;
  color: #249573;
}
.task-steps .current {
  color: var(--tf-brand);
  font-weight: 700;
}
.task-steps .current i {
  background: var(--tf-brand);
  color: #fff;
}
.task-detail-grid {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 16px;
  align-items: center;
  margin: 0;
  font-size: 11px;
}
.task-detail-grid dt {
  color: #96a6bd;
}
.task-detail-grid dd {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-weight: 700;
}
.task-detail-grid .tf-avatar {
  width: 24px;
  height: 24px;
  font-size: 10px;
}
.task-activities {
  display: grid;
  gap: 20px;
}
.task-activity {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 11px;
  line-height: 1.55;
}
.task-activity .tf-avatar {
  width: 25px;
  height: 25px;
  font-size: 10px;
}
.task-activity small {
  display: block;
  margin-top: 7px;
  color: #a0aec0;
  font-size: 10px;
}
.task-action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--tf-line);
}
.task-edit-hint {
  margin-bottom: 24px;
}
.task-drawer-body .el-select,
.task-drawer-body .el-date-editor {
  width: 100%;
}
.conflict-kicker {
  color: var(--tf-danger) !important;
}
.conflict-versions {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.conflict-versions > div {
  padding: 15px;
  border: 1px solid var(--tf-line);
  border-radius: 10px;
  background: #f9fbfe;
}
.conflict-versions small {
  color: #8a9bb0;
  font-size: 10px;
}
.conflict-versions strong {
  display: block;
  margin-top: 6px;
  font-size: 16px;
}
.conflict-versions p {
  margin: 7px 0 0;
  color: #8192a9;
  font-size: 10px;
}
.conflict-versions > span {
  color: #9caac0;
}
@media (max-width: 767px) {
  .task-action-bar {
    flex-wrap: wrap;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatApiError } from '../../api/client'
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
  members: MemberView[]
  projectOwner: boolean
  projectActive: boolean
  currentUserId: string
}>()
const emit = defineEmits<{ updated: [] }>()
const task = ref<TaskView | null>(null)
const activities = ref<ActivityView[]>([])
const activityPage = ref(1)
const activityTotal = ref(0)
const title = ref('')
const description = ref('')
const priority = ref<TaskPriority>('MEDIUM')
const assigneeId = ref('')
const busy = ref(false)
const errorMessage = ref('')
const isReporter = computed(() => task.value?.reporterId === props.currentUserId)
const isAssignee = computed(() => task.value?.assigneeId === props.currentUserId)
const canEditCore = computed(() => props.projectActive && (props.projectOwner || isReporter.value))
const canEditDescription = computed(
  () => props.projectActive && (props.projectOwner || isReporter.value || isAssignee.value),
)
const transitions = computed(() =>
  task.value && task.value.assigneeId && props.projectActive
    ? availableTransitions(task.value.status, props.projectOwner, isAssignee.value)
    : [],
)

async function load(): Promise<void> {
  if (!props.taskId) return
  busy.value = true
  errorMessage.value = ''
  try {
    const [detail, history] = await Promise.all([
      getTask(props.taskId),
      listActivities(props.taskId, activityPage.value),
    ])
    task.value = detail
    activities.value = history.items
    activityTotal.value = history.total
    title.value = detail.title
    description.value = detail.description ?? ''
    priority.value = detail.priority
    assigneeId.value = detail.assigneeId ?? ''
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    busy.value = false
  }
}

async function save(): Promise<void> {
  const current = task.value
  if (!current) return
  const input: Parameters<typeof editTask>[1] = { version: current.version }
  if (canEditCore.value) {
    if (title.value.trim() !== current.title) input.title = title.value.trim()
    if (priority.value !== current.priority) input.priority = priority.value
  }
  if (canEditDescription.value && description.value !== (current.description ?? ''))
    input.description = description.value
  if (props.projectOwner && assigneeId.value !== (current.assigneeId ?? '')) {
    if (assigneeId.value) input.assigneeId = assigneeId.value
    else input.unassign = true
  }
  if (Object.keys(input).length === 1) return
  busy.value = true
  errorMessage.value = ''
  try {
    await editTask(current.id, input)
    await load()
    emit('updated')
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    busy.value = false
  }
}

async function move(toStatus: TaskStatus): Promise<void> {
  const current = task.value
  if (!current) return
  busy.value = true
  errorMessage.value = ''
  try {
    await transitionTask(current.id, current.version, toStatus)
    await load()
    emit('updated')
  } catch (error) {
    errorMessage.value = formatApiError(error)
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
      activities.value = []
      void load()
    }
  },
  { immediate: true },
)
</script>

<template>
  <el-drawer v-model="visible" title="任务详情" size="min(100%, 580px)">
    <div v-loading="busy">
      <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
      <template v-if="task">
        <p>状态：{{ task.status }} · 版本：{{ task.version }}</p>
        <el-form label-position="top" @submit.prevent="save">
          <el-form-item label="标题"
            ><el-input v-model="title" :disabled="!canEditCore" maxlength="200"
          /></el-form-item>
          <el-form-item label="描述"
            ><el-input
              v-model="description"
              type="textarea"
              :disabled="!canEditDescription"
              maxlength="10000"
          /></el-form-item>
          <el-form-item label="优先级"
            ><el-select v-model="priority" :disabled="!canEditCore"
              ><el-option label="低" value="LOW" /><el-option label="中" value="MEDIUM" /><el-option
                label="高"
                value="HIGH" /></el-select
          ></el-form-item>
          <el-form-item label="负责人"
            ><el-select
              v-model="assigneeId"
              clearable
              :disabled="!projectOwner || !projectActive"
              placeholder="未指派"
              ><el-option
                v-for="member in members"
                :key="member.userId"
                :label="member.displayName"
                :value="member.userId" /></el-select
          ></el-form-item>
          <el-button
            v-if="canEditCore || canEditDescription || (projectOwner && projectActive)"
            type="primary"
            native-type="submit"
            :loading="busy"
            >保存修改</el-button
          >
        </el-form>
        <div class="transitions">
          <el-button
            v-for="status in transitions"
            :key="status"
            :loading="busy"
            @click="move(status)"
            >流转到 {{ status }}</el-button
          >
        </div>
        <h3>任务活动</h3>
        <el-timeline
          ><el-timeline-item
            v-for="activity in activities"
            :key="activity.id"
            :timestamp="activity.createdAt"
            >{{ activity.action
            }}<span v-if="activity.fromValue || activity.toValue"
              >：{{ activity.fromValue }} → {{ activity.toValue }}</span
            ></el-timeline-item
          ></el-timeline
        >
        <el-pagination
          layout="prev, pager, next, total"
          :current-page="activityPage"
          :page-size="20"
          :total="activityTotal"
          @current-change="loadActivityPage"
        />
      </template>
    </div>
  </el-drawer>
</template>

<style scoped>
.transitions {
  display: flex;
  gap: 8px;
  margin: 20px 0;
  flex-wrap: wrap;
}
</style>

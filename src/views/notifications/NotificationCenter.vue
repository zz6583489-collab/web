<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatApiError } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markNotificationRead,
  notificationText,
  type NotificationView,
} from './notificationApi'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const open = ref(false)
const unreadOnly = ref(false)
const unreadCount = ref(0)
const page = ref(1)
const total = ref(0)
const items = ref<NotificationView[]>([])
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const groups = computed(() => {
  const byDay = new Map<string, NotificationView[]>()
  for (const item of items.value) {
    const key = new Date(item.createdAt).toDateString()
    const group = byDay.get(key) ?? []
    group.push(item)
    byDay.set(key, group)
  }
  return [...byDay].map(([key, entries]) => ({
    key,
    label: dayLabel(entries[0]!.createdAt),
    entries,
  }))
})

function dayLabel(createdAt: string): string {
  const day = new Date(createdAt)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (day.toDateString() === today.toDateString()) return '今天'
  if (day.toDateString() === yesterday.toDateString()) return '昨天'
  return day.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

async function refreshCount(): Promise<void> {
  if (!auth.token) {
    unreadCount.value = 0
    return
  }
  try {
    unreadCount.value = await getUnreadCount()
  } catch (error) {
    errorMessage.value = formatApiError(error)
  }
}

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const [result, count] = await Promise.all([
      listNotifications(page.value, unreadOnly.value),
      getUnreadCount(),
    ])
    items.value = result.items
    total.value = result.total
    unreadCount.value = count
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

async function readAll(): Promise<void> {
  submitting.value = true
  errorMessage.value = ''
  try {
    await markAllRead()
    page.value = 1
    await load()
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

async function openTarget(item: NotificationView): Promise<void> {
  submitting.value = true
  errorMessage.value = ''
  try {
    if (!item.readAt) await markNotificationRead(item.id)
    await refreshCount()
    open.value = false
    await router.push({
      name: 'project-detail',
      params: { id: item.projectId },
      query: item.taskId ? { taskId: item.taskId } : {},
    })
  } catch (error) {
    errorMessage.value = formatApiError(error)
    await load()
  } finally {
    submitting.value = false
  }
}

function changePage(next: number): void {
  page.value = next
  void load()
}

async function returnToProjects(): Promise<void> {
  open.value = false
  await router.push({ name: 'home' })
}

watch(
  () => [auth.token, route.fullPath],
  () => {
    void refreshCount()
  },
  { immediate: true },
)
watch(open, (value) => {
  if (value) void load()
})
watch(unreadOnly, () => {
  page.value = 1
  if (open.value) void load()
})
</script>

<template>
  <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
    <el-button aria-label="消息通知" @click="open = true">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      通知
    </el-button>
  </el-badge>
  <el-drawer v-model="open" title="消息通知" size="min(420px, 100vw)">
    <div class="notification-controls">
      <el-radio-group v-model="unreadOnly" aria-label="通知筛选">
        <el-radio-button :value="false">全部消息</el-radio-button>
        <el-radio-button :value="true">未读</el-radio-button>
      </el-radio-group>
      <el-button
        link
        type="primary"
        :disabled="unreadCount === 0"
        :loading="submitting"
        @click="readAll"
        >全部标为已读</el-button
      >
    </div>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <div v-loading="loading" class="notification-list">
      <el-empty v-if="!loading && items.length === 0" description="暂时没有新消息">
        <el-button @click="returnToProjects">返回项目空间</el-button>
      </el-empty>
      <section v-for="group in groups" :key="group.key" aria-label="通知日期">
        <h3 class="notification-day">{{ group.label }}</h3>
        <button
          v-for="item in group.entries"
          :key="item.id"
          type="button"
          class="notification-item"
          :class="{ unread: !item.readAt }"
          :disabled="submitting"
          @click="openTarget(item)"
        >
          <span class="notification-title"
            >{{ notificationText(item).title }}<i v-if="!item.readAt"
          /></span>
          <span class="notification-description">{{ notificationText(item).description }}</span>
          <span class="notification-meta"
            >{{ item.projectName }} · {{ new Date(item.createdAt).toLocaleString('zh-CN') }}</span
          >
        </button>
      </section>
    </div>
    <el-pagination
      v-if="total > 20"
      class="notification-pagination"
      layout="prev, pager, next"
      :current-page="page"
      :page-size="20"
      :total="total"
      @current-change="changePage"
    />
    <p class="notification-hint">打开目标时会再次校验项目权限。</p>
  </el-drawer>
</template>

<style scoped>
.notification-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.notification-list {
  min-height: 180px;
  max-height: calc(100vh - 215px);
  overflow-y: auto;
}
.notification-day {
  color: #75849b;
  font-size: 12px;
  margin: 16px 0 10px;
}
.notification-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: left;
  gap: 8px;
  margin-bottom: 10px;
  padding: 14px;
  border: 1px solid #e6eaf1;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}
.notification-item:hover,
.notification-item:focus-visible {
  border-color: #7da2fa;
  outline: none;
}
.notification-item.unread {
  background: #f4f7ff;
  border-color: #d9e5ff;
}
.notification-title {
  font-weight: 700;
  color: #24344f;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.notification-title i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2f61e8;
}
.notification-description {
  color: #52627a;
  line-height: 1.5;
}
.notification-meta,
.notification-hint {
  color: #8795aa;
  font-size: 12px;
}
.notification-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}
.notification-hint {
  margin-top: 20px;
}
</style>

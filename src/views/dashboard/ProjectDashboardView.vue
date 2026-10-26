<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatApiError } from '../../api/client'
import { getProject, type ProjectView } from '../projects/projectApi'
import { getTaskStats, type TaskStats } from '../tasks/taskApi'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.id))
const project = ref<ProjectView | null>(null)
const stats = ref<TaskStats | null>(null)
const loading = ref(false)
const errorMessage = ref('')

const distribution = computed(() => {
  const value = stats.value
  if (!value) return []
  return [
    { label: '待开始', count: value.todo, color: '#5f708a' },
    { label: '进行中', count: value.inProgress, color: '#2f61e8' },
    { label: '待评审', count: value.inReview, color: '#b77919' },
    { label: '已完成', count: value.done, color: '#17886e' },
  ].map((row) => ({ ...row, percent: value.total === 0 ? 0 : (row.count / value.total) * 100 }))
})

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const [detail, summary] = await Promise.all([
      getProject(projectId.value),
      getTaskStats(projectId.value),
    ])
    project.value = detail
    stats.value = summary
  } catch (error) {
    errorMessage.value = formatApiError(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
watch(projectId, () => {
  void load()
})
</script>

<template>
  <main v-loading="loading" class="page-shell">
    <el-button link @click="router.push({ name: 'project-detail', params: { id: projectId } })"
      >← 返回项目</el-button
    >
    <h1>项目统计</h1>
    <p class="subtitle">{{ project?.name }} · {{ project?.status }}</p>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <template v-if="stats">
      <div class="metric-grid">
        <el-card><el-statistic title="总任务" :value="stats.total" /></el-card>
        <el-card><el-statistic title="已完成" :value="stats.done" /></el-card>
        <el-card><el-statistic title="逾期未完成" :value="stats.overdue" /></el-card>
      </div>
      <el-card class="section">
        <template #header>完成率</template>
        <strong>{{ stats.completionRatePercent }}%</strong>
        <el-progress :percentage="stats.completionRatePercent" :show-text="false" />
      </el-card>
      <el-card class="section">
        <template #header>任务状态分布</template>
        <div v-for="row in distribution" :key="row.label" class="distribution-row">
          <span>{{ row.label }}：{{ row.count }}</span>
          <div
            class="distribution-track"
            role="img"
            :aria-label="`${row.label} ${row.count} 个，占 ${row.percent.toFixed(1)}%`"
          >
            <div
              class="distribution-fill"
              :style="{ width: `${row.percent}%`, backgroundColor: row.color }"
            />
          </div>
        </div>
      </el-card>
    </template>
  </main>
</template>

<style scoped>
.page-shell {
  max-width: 1100px;
  margin: 36px auto;
  padding: 0 24px;
}
h1 {
  margin: 12px 0 4px;
}
.subtitle {
  margin: 0 0 24px;
  color: #667085;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.section {
  margin-bottom: 20px;
}
.section strong {
  display: block;
  font-size: 24px;
  margin-bottom: 16px;
}
.distribution-row {
  margin: 16px 0;
}
.distribution-row span {
  display: block;
  margin-bottom: 8px;
}
.distribution-track {
  height: 12px;
  border-radius: 6px;
  background: #edf1f7;
  overflow: hidden;
}
.distribution-fill {
  height: 100%;
  border-radius: 6px;
}
@media (max-width: 720px) {
  .page-shell {
    margin: 16px auto;
    padding: 0 16px;
  }
}
</style>

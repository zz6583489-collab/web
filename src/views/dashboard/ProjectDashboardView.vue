<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, formatApiError } from '../../api/client'
import { getProject, type ProjectView } from '../projects/projectApi'
import { getTaskStats, type TaskStats } from '../tasks/taskApi'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.id))
const project = ref<ProjectView | null>(null)
const stats = ref<TaskStats | null>(null)
const loading = ref(false)
const unavailable = ref(false)
const errorMessage = ref('')

const distribution = computed(() => {
  const value = stats.value
  if (!value) return []
  return [
    { label: '待处理', count: value.todo, color: '#dfe6f0' },
    { label: '进行中', count: value.inProgress, color: '#8d79d8' },
    { label: '待评审', count: value.inReview, color: '#e6aa5d' },
    { label: '已完成', count: value.done, color: '#2f61e8' },
  ].map((row) => ({
    ...row,
    percent: value.total === 0 ? 0 : (row.count / value.total) * 100,
  }))
})

const donutBackground = computed(() => {
  const rows = distribution.value
  if (!rows.length || !stats.value?.total) return '#edf1f7'
  let start = 0
  const stops = rows.map((row) => {
    const end = start + row.percent
    const segment = row.color + ' ' + start + '% ' + end + '%'
    start = end
    return segment
  })
  return 'conic-gradient(' + stops.join(', ') + ')'
})

async function load(): Promise<void> {
  loading.value = true
  unavailable.value = false
  errorMessage.value = ''
  try {
    const [detail, summary] = await Promise.all([
      getProject(projectId.value),
      getTaskStats(projectId.value),
    ])
    project.value = detail
    stats.value = summary
  } catch (error) {
    project.value = null
    stats.value = null
    if (error instanceof ApiError && error.code === 'PROJECT.NOT_FOUND') unavailable.value = true
    else errorMessage.value = formatApiError(error)
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
  <main v-loading="loading" class="tf-page dashboard-page">
    <div v-if="unavailable" class="tf-empty unavailable-state">
      <span class="tf-empty-symbol">◇</span>
      <h2>项目无法访问</h2>
      <p>项目可能不存在，或你已经不在该项目中。</p>
      <el-button type="primary" @click="router.push({ name: 'home' })">返回项目空间 →</el-button>
    </div>
    <template v-else>
      <header class="tf-page-heading">
        <div>
          <span class="tf-eyebrow">PROJECT INSIGHTS</span>
          <h1>项目统计</h1>
          <p>{{ project?.name || '加载中' }} · 数据每次打开时刷新</p>
        </div>
        <el-button @click="router.push({ name: 'project-detail', params: { id: projectId } })"
          >← 返回项目</el-button
        >
      </header>
      <el-alert
        v-if="errorMessage"
        class="tf-error-alert"
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon
      />
      <template v-if="stats">
        <div class="stats-kpis">
          <div class="tf-surface">
            <span>全部任务</span><strong>{{ stats.total }}</strong
            ><small>当前项目全部任务</small><i>▦</i>
          </div>
          <div class="tf-surface">
            <span>已完成</span><strong>{{ stats.done }}</strong
            ><small>完成率 {{ stats.completionRatePercent }}%</small><i class="green">✓</i>
          </div>
          <div class="tf-surface">
            <span>进行中</span><strong>{{ stats.inProgress }}</strong
            ><small>另有 {{ stats.inReview }} 项待评审</small><i class="purple">◐</i>
          </div>
          <div class="tf-surface">
            <span>逾期任务</span><strong>{{ stats.overdue }}</strong
            ><small>尚未完成且已过截止时间</small><i class="red">!</i>
          </div>
        </div>
        <div class="stats-charts">
          <section class="tf-surface">
            <div class="chart-heading">
              <h2>任务状态分布</h2>
              <p>当前项目全部任务</p>
            </div>
            <div class="donut-area">
              <div class="donut" :style="{ background: donutBackground }">
                <div>
                  <strong>{{ stats.total }}</strong
                  ><small>项任务</small>
                </div>
              </div>
              <div class="donut-legend">
                <div v-for="row in distribution" :key="row.label">
                  <i :style="{ background: row.color }" /><span>{{ row.label }}</span
                  ><strong>{{ row.count }}</strong>
                </div>
              </div>
            </div>
          </section>
          <section class="tf-surface">
            <div class="chart-heading">
              <h2>完成情况</h2>
              <p>以当前项目任务为统计口径</p>
            </div>
            <div class="completion-card">
              <strong>{{ stats.completionRatePercent }}%</strong><span>任务完成率</span>
              <div class="completion-track">
                <i :style="{ width: stats.completionRatePercent + '%' }" />
              </div>
              <p>已完成 {{ stats.done }} 项，共 {{ stats.total }} 项</p>
            </div>
            <div class="status-bars">
              <div v-for="row in distribution" :key="row.label">
                <span>{{ row.label }}</span
                ><strong>{{ row.count }}</strong>
                <div><i :style="{ width: row.percent + '%', background: row.color }" /></div>
              </div>
            </div>
          </section>
        </div>
        <p class="tf-hint stats-note">逾期任务按当前 UTC 时间计算；本页使用现有单项目统计接口。</p>
      </template>
    </template>
  </main>
</template>

<style scoped>
.stats-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stats-kpis > div {
  position: relative;
  height: 147px;
  padding: 21px;
}
.stats-kpis span {
  display: block;
  color: #8898ad;
  font-size: 11px;
}
.stats-kpis strong {
  display: block;
  margin: 13px 0 7px;
  font-size: 30px;
}
.stats-kpis small {
  color: #9aa7b8;
  font-size: 10px;
}
.stats-kpis i {
  position: absolute;
  right: 20px;
  top: 22px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: #e8efff;
  color: var(--tf-brand);
  font-style: normal;
}
.stats-kpis i.green {
  background: #e4f5ee;
  color: #239675;
}
.stats-kpis i.purple {
  background: #f1eaff;
  color: #8b68c4;
}
.stats-kpis i.red {
  background: #ffebef;
  color: #d45869;
}
.stats-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.stats-charts > section {
  min-height: 392px;
  padding: 22px;
}
.chart-heading h2 {
  margin: 0 0 6px;
  font-size: 15px;
}
.chart-heading p {
  margin: 0;
  color: #a0adbd;
  font-size: 10px;
}
.donut-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 42px;
  min-height: 300px;
}
.donut {
  display: grid;
  place-items: center;
  flex: none;
  width: 205px;
  height: 205px;
  border-radius: 50%;
}
.donut > div {
  display: grid;
  place-content: center;
  width: 145px;
  height: 145px;
  border-radius: 50%;
  background: #fff;
  text-align: center;
}
.donut strong {
  font-size: 30px;
}
.donut small {
  color: #9ba9ba;
  font-size: 10px;
}
.donut-legend {
  display: grid;
  gap: 18px;
  min-width: 125px;
}
.donut-legend > div {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #8796aa;
  font-size: 11px;
}
.donut-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.donut-legend strong {
  margin-left: auto;
  color: #384b66;
}
.completion-card {
  margin: 34px 0 28px;
  padding: 19px;
  border-radius: 11px;
  background: #f5f8ff;
}
.completion-card strong {
  display: block;
  font-size: 29px;
}
.completion-card span,
.completion-card p {
  color: #8797af;
  font-size: 10px;
}
.completion-track,
.status-bars > div > div {
  height: 9px;
  margin: 12px 0;
  overflow: hidden;
  border-radius: 8px;
  background: #ecf0f7;
}
.completion-track i,
.status-bars i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tf-brand);
}
.completion-card p {
  margin: 0;
}
.status-bars {
  display: grid;
  gap: 10px;
}
.status-bars > div {
  display: grid;
  grid-template-columns: 1fr auto;
  color: #657891;
  font-size: 11px;
}
.status-bars > div > div {
  grid-column: 1/3;
  margin: 7px 0;
}
.stats-note {
  margin-top: 20px;
}
@media (max-width: 1100px) {
  .stats-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
  .stats-charts {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 767px) {
  .stats-kpis {
    gap: 10px;
  }
  .stats-kpis > div {
    height: 125px;
    padding: 14px;
  }
  .donut-area {
    flex-direction: column;
    gap: 22px;
  }
  .donut-legend {
    width: 100%;
  }
}
</style>

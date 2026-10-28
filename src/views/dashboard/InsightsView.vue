<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatApiError } from '../../api/client'
import { listProjects, type ProjectView } from '../projects/projectApi'
import { getTaskStats, type TaskStats } from '../tasks/taskApi'
import { aggregateProjectStats } from './insights'

interface ProjectSummary {
  project: ProjectView
  stats: TaskStats
}

const entries = ref<ProjectSummary[]>([])
const loading = ref(false)
const errorMessage = ref('')
let loadSequence = 0

const aggregate = computed(() => aggregateProjectStats(entries.value))

const distribution = computed(() => [
  { label: '已完成', count: aggregate.value.done, color: '#2f61e8' },
  { label: '进行中', count: aggregate.value.inProgress, color: '#8d79d8' },
  { label: '待评审', count: aggregate.value.inReview, color: '#e6aa5d' },
  { label: '待处理', count: aggregate.value.todo, color: '#dfe6f0' },
])

const donutBackground = computed(() => {
  if (aggregate.value.total === 0) return '#edf1f7'
  let start = 0
  return (
    'conic-gradient(' +
    distribution.value
      .map((item) => {
        const end = start + (item.count / aggregate.value.total) * 100
        const segment = item.color + ' ' + start + '% ' + end + '%'
        start = end
        return segment
      })
      .join(', ') +
    ')'
  )
})

async function load(): Promise<void> {
  const sequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  try {
    const firstPage = await listProjects(1)
    const projects = [...firstPage.items]
    const pageSize = firstPage.pageSize > 0 ? firstPage.pageSize : 20
    for (let page = 2; (page - 1) * pageSize < firstPage.total; page += 1) {
      const result = await listProjects(page)
      projects.push(...result.items)
    }
    const summaries: ProjectSummary[] = []
    for (let index = 0; index < projects.length; index += 4) {
      const batch = projects.slice(index, index + 4)
      const data = await Promise.all(
        batch.map(async (project) => ({ project, stats: await getTaskStats(project.id) })),
      )
      summaries.push(...data)
    }
    if (sequence === loadSequence) entries.value = summaries
  } catch (error) {
    if (sequence === loadSequence) {
      entries.value = []
      errorMessage.value = formatApiError(error)
    }
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <main v-loading="loading" class="tf-page insights-page">
    <header class="tf-page-heading">
      <div>
        <span class="tf-eyebrow">PROJECT INSIGHTS · P1</span>
        <h1>统计概览</h1>
        <p>汇总你当前可访问的项目任务，安排下一步工作。</p>
      </div>
      <el-button @click="load">刷新数据</el-button>
    </header>
    <el-alert
      v-if="errorMessage"
      class="tf-error-alert"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />
    <template v-if="!loading && !errorMessage">
      <div v-if="entries.length === 0" class="tf-empty tf-surface">
        <span class="tf-empty-symbol">▤</span>
        <h2>暂无项目统计</h2>
        <p>加入或创建项目后，这里会显示任务进度。</p>
        <RouterLink class="el-button el-button--primary" :to="{ name: 'home' }"
          >查看项目空间</RouterLink
        >
      </div>
      <template v-else>
        <div class="insights-kpis">
          <div class="tf-surface">
            <span>全部任务</span><strong>{{ aggregate.total }}</strong
            ><small>覆盖 {{ entries.length }} 个项目</small><i>▦</i>
          </div>
          <div class="tf-surface">
            <span>已完成</span><strong>{{ aggregate.done }}</strong
            ><small>完成率 {{ aggregate.completionRate }}%</small><i class="green">✓</i>
          </div>
          <div class="tf-surface">
            <span>进行中</span><strong>{{ aggregate.inProgress }}</strong
            ><small>其中 {{ aggregate.inReview }} 项待评审</small><i class="purple">◐</i>
          </div>
          <div class="tf-surface">
            <span>逾期任务</span><strong>{{ aggregate.overdue }}</strong
            ><small>尚未完成且已过截止时间</small><i class="red">!</i>
          </div>
        </div>
        <div class="insights-charts">
          <section class="tf-surface">
            <div class="insights-heading">
              <h2>任务状态分布</h2>
              <p>当前全部参与项目</p>
            </div>
            <div class="insights-donut-area">
              <div class="insights-donut" :style="{ background: donutBackground }">
                <div>
                  <strong>{{ aggregate.total }}</strong
                  ><small>项任务</small>
                </div>
              </div>
              <div class="insights-legend">
                <div v-for="row in distribution" :key="row.label">
                  <i :style="{ background: row.color }" /><span>{{ row.label }}</span
                  ><strong>{{ row.count }}</strong>
                </div>
              </div>
            </div>
          </section>
          <section class="tf-surface">
            <div class="insights-heading">
              <h2>项目完成情况</h2>
              <p>按任务完成比例排序</p>
            </div>
            <div class="project-bars">
              <RouterLink
                v-for="entry in [...entries].sort(
                  (a, b) => b.stats.completionRatePercent - a.stats.completionRatePercent,
                )"
                :key="entry.project.id"
                :to="{ name: 'project-dashboard', params: { id: entry.project.id } }"
                ><span>{{ entry.project.name }}</span
                ><strong>{{ entry.stats.completionRatePercent }}%</strong
                ><i><em :style="{ width: entry.stats.completionRatePercent + '%' }" /></i
              ></RouterLink>
            </div>
          </section>
        </div>
        <p class="tf-hint insights-note">
          跨项目数据由现有单项目统计接口实时汇总；历史环比和时间筛选尚无数据来源。
        </p>
      </template>
    </template>
  </main>
</template>

<style scoped>
.insights-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.insights-kpis > div {
  position: relative;
  height: 147px;
  padding: 21px;
}
.insights-kpis span {
  display: block;
  color: #8898ad;
  font-size: 11px;
}
.insights-kpis strong {
  display: block;
  margin: 13px 0 7px;
  font-size: 30px;
}
.insights-kpis small {
  color: #9aa7b8;
  font-size: 10px;
}
.insights-kpis i {
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
.insights-kpis i.green {
  background: #e4f5ee;
  color: #239675;
}
.insights-kpis i.purple {
  background: #f1eaff;
  color: #8b68c4;
}
.insights-kpis i.red {
  background: #ffebef;
  color: #d45869;
}
.insights-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.insights-charts > section {
  min-height: 392px;
  padding: 22px;
}
.insights-heading h2 {
  margin: 0 0 6px;
  font-size: 15px;
}
.insights-heading p {
  margin: 0;
  color: #a0adbd;
  font-size: 10px;
}
.insights-donut-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 42px;
  min-height: 300px;
}
.insights-donut {
  display: grid;
  place-items: center;
  flex: none;
  width: 205px;
  height: 205px;
  border-radius: 50%;
}
.insights-donut > div {
  display: grid;
  place-content: center;
  width: 145px;
  height: 145px;
  border-radius: 50%;
  background: #fff;
  text-align: center;
}
.insights-donut strong {
  font-size: 30px;
}
.insights-donut small {
  color: #9ba9ba;
  font-size: 10px;
}
.insights-legend {
  display: grid;
  gap: 18px;
  min-width: 125px;
}
.insights-legend > div {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #8796aa;
  font-size: 11px;
}
.insights-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.insights-legend strong {
  margin-left: auto;
  color: #384b66;
}
.project-bars {
  display: grid;
  gap: 24px;
  margin-top: 42px;
}
.project-bars a {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0 10px;
  color: #657891;
  font-size: 11px;
}
.project-bars a:hover {
  color: var(--tf-brand);
}
.project-bars strong {
  color: var(--tf-ink);
  font-size: 10px;
}
.project-bars i {
  grid-column: 1/3;
  height: 9px;
  margin-top: 11px;
  overflow: hidden;
  border-radius: 8px;
  background: #ecf0f7;
}
.project-bars em {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tf-brand);
}
.insights-note {
  margin-top: 20px;
}
@media (max-width: 1100px) {
  .insights-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
  .insights-charts {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 767px) {
  .insights-kpis {
    gap: 10px;
  }
  .insights-kpis > div {
    height: 125px;
    padding: 14px;
  }
  .insights-donut-area {
    flex-direction: column;
    gap: 22px;
  }
  .insights-legend {
    width: 100%;
  }
}
</style>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatApiError } from '../../api/client'
import { getTaskStats } from '../tasks/taskApi'
import { createProject, listProjects, type ProjectView } from './projectApi'

type StatusFilter = 'ACTIVE' | 'ARCHIVED' | ''

const router = useRouter()
const projects = ref<ProjectView[]>([])
const progress = ref<Record<string, number>>({})
const page = ref(1)
const total = ref(0)
const statusFilter = ref<StatusFilter>('')
const loading = ref(false)
const submitting = ref(false)
const dialogOpen = ref(false)
const name = ref('')
const description = ref('')
const errorMessage = ref('')
const dialogError = ref('')
let loadSequence = 0

function updatedLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '更新时间未知'
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date)
}

async function loadProjects(nextPage = page.value): Promise<void> {
  const sequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listProjects(nextPage, statusFilter.value || undefined)
    if (sequence !== loadSequence) return
    projects.value = result.items
    page.value = result.page
    total.value = result.total
    progress.value = {}
    const summaries = await Promise.allSettled(
      result.items.map((project) => getTaskStats(project.id)),
    )
    if (sequence !== loadSequence) return
    progress.value = Object.fromEntries(
      result.items.flatMap((project, index) => {
        const summary = summaries[index]
        return summary?.status === 'fulfilled'
          ? [[project.id, summary.value.completionRatePercent]]
          : []
      }),
    )
  } catch (error) {
    if (sequence === loadSequence) errorMessage.value = formatApiError(error)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function selectFilter(value: StatusFilter): Promise<void> {
  statusFilter.value = value
  await loadProjects(1)
}

function resetForm(): void {
  name.value = ''
  description.value = ''
  dialogError.value = ''
}

async function submitProject(): Promise<void> {
  if (!name.value.trim()) {
    dialogError.value = '请输入项目名称'
    return
  }
  submitting.value = true
  dialogError.value = ''
  try {
    const project = await createProject(name.value.trim(), description.value.trim())
    dialogOpen.value = false
    resetForm()
    await router.push({ name: 'project-detail', params: { id: project.id } })
  } catch (error) {
    dialogError.value = formatApiError(error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void loadProjects()
})
</script>

<template>
  <main class="tf-page project-home">
    <header class="tf-page-heading">
      <div>
        <span class="tf-eyebrow">PROJECT WORKSPACE</span>
        <h1>项目空间</h1>
        <p>聚焦正在推进的工作，与团队保持同步。</p>
      </div>
      <el-button type="primary" @click="dialogOpen = true">＋ 新建项目</el-button>
    </header>
    <el-alert
      v-if="errorMessage"
      class="tf-error-alert"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />

    <section aria-label="我的项目">
      <div class="tf-section-heading">
        <div>
          <h2>
            我的项目 <span class="tf-count-chip">{{ total }}</span>
          </h2>
          <p>你参与的全部项目</p>
        </div>
        <div class="project-filters" role="group" aria-label="项目状态">
          <button
            :class="{ selected: statusFilter === '' }"
            type="button"
            @click="selectFilter('')"
          >
            全部项目
          </button>
          <button
            :class="{ selected: statusFilter === 'ACTIVE' }"
            type="button"
            @click="selectFilter('ACTIVE')"
          >
            进行中
          </button>
          <button
            :class="{ selected: statusFilter === 'ARCHIVED' }"
            type="button"
            @click="selectFilter('ARCHIVED')"
          >
            已归档
          </button>
        </div>
      </div>
      <div v-loading="loading" class="project-grid">
        <button
          v-for="(project, index) in projects"
          :key="project.id"
          class="project-card tf-surface"
          type="button"
          @click="router.push({ name: 'project-detail', params: { id: project.id } })"
        >
          <span class="project-card-top"
            ><span class="project-icon" :class="`tone-${index % 3}`">{{
              project.name.slice(0, 1)
            }}</span
            ><span class="tf-status" :class="project.status === 'ACTIVE' ? 'active' : 'archived'">{{
              project.status === 'ACTIVE' ? '● 进行中' : '已归档'
            }}</span></span
          >
          <strong class="project-card-name">{{ project.name }}</strong>
          <span class="project-card-description">{{ project.description || '暂无项目说明' }}</span>
          <span class="project-progress-label"
            ><span>{{ project.status === 'ACTIVE' ? '任务进度' : '项目状态' }}</span
            ><strong>{{
              project.status === 'ACTIVE'
                ? progress[project.id] === undefined
                  ? '—'
                  : `${progress[project.id]}%`
                : '已归档'
            }}</strong></span
          >
          <span class="project-progress"
            ><span
              :style="{
                width: `${project.status === 'ARCHIVED' ? 100 : (progress[project.id] ?? 0)}%`,
              }"
          /></span>
          <span class="project-card-foot"
            ><span>项目 ID {{ project.id }}</span
            ><span>最后更新 · {{ updatedLabel(project.updatedAt) }}</span></span
          >
        </button>
        <button
          v-if="!loading && statusFilter === ''"
          class="project-create-card"
          type="button"
          @click="dialogOpen = true"
        >
          <span>＋</span><strong>创建新项目</strong><small>从清晰的目标开始下一段协作</small>
        </button>
      </div>
      <div
        v-if="!loading && projects.length === 0 && statusFilter !== ''"
        class="tf-empty tf-surface"
      >
        <span class="tf-empty-symbol">◇</span>
        <h2>这里还没有项目</h2>
        <p>切换状态筛选，或返回全部项目查看。</p>
        <el-button @click="selectFilter('')">查看全部项目</el-button>
      </div>
      <el-pagination
        v-if="total > 20"
        class="tf-pager"
        layout="prev, pager, next, total"
        :current-page="page"
        :page-size="20"
        :total="total"
        @current-change="loadProjects"
      />
      <p class="tf-hint project-footer-note">
        只有你参与的项目会出现在这里。被移除后访问权限立即失效。
      </p>
    </section>

    <el-dialog v-model="dialogOpen" title="创建项目" width="560" @closed="resetForm">
      <template #header
        ><div class="tf-dialog-heading">
          <span>PROJECT SETUP · P0</span><strong>创建项目</strong
          ><small>确定项目名称与目标，再邀请成员一起推进。</small>
        </div></template
      >
      <div class="tf-hint-panel project-owner-hint">
        <span class="tf-hint-icon">◇</span>
        <div>
          <strong>你将成为项目负责人</strong>
          <p>创建后自动加入项目并获得 OWNER 身份。</p>
        </div>
      </div>
      <el-form label-position="top" @submit.prevent="submitProject">
        <el-form-item label="项目名称"
          ><el-input v-model="name" maxlength="160" show-word-limit placeholder="输入项目名称"
        /></el-form-item>
        <el-form-item label="项目描述"
          ><el-input
            v-model="description"
            type="textarea"
            maxlength="10000"
            :rows="3"
            placeholder="简要说明项目目标（可选）"
        /></el-form-item>
        <p class="tf-hint">创建后可在项目设置中修改信息，并添加项目成员和任务。</p>
        <el-alert
          v-if="dialogError"
          class="tf-error-alert"
          :title="dialogError"
          type="error"
          :closable="false"
        />
      </el-form>
      <template #footer
        ><div class="tf-dialog-footer">
          <span>下一步可添加项目成员和任务。</span>
          <div>
            <el-button @click="dialogOpen = false">取消</el-button
            ><el-button type="primary" :loading="submitting" @click="submitProject"
              >创建项目 →</el-button
            >
          </div>
        </div></template
      >
    </el-dialog>
  </main>
</template>

<style scoped>
.project-filters {
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 9px;
  background: #eaf0f8;
}
.project-filters button {
  min-height: 32px;
  padding: 0 13px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #6d7d96;
  font-size: 11px;
}
.project-filters button.selected {
  background: #fff;
  color: var(--tf-brand);
  font-weight: 700;
  box-shadow: 0 1px 4px #43557714;
}
.project-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  min-height: 235px;
}
.project-card {
  display: flex;
  flex-direction: column;
  min-height: 235px;
  padding: 18px;
  text-align: left;
  transition:
    border-color 0.2s,
    transform 0.2s;
}
.project-card:hover {
  border-color: #aac0fa;
  transform: translateY(-2px);
}
.project-card-top,
.project-progress-label,
.project-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.project-icon {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  border-radius: 10px;
  background: #e7edff;
  color: #4169df;
  font-weight: 800;
}
.project-icon.tone-1 {
  background: #f1e9ff;
  color: #8558cb;
}
.project-icon.tone-2 {
  background: #fff1e4;
  color: #c47d3e;
}
.project-card-name {
  margin-top: 15px;
  font-size: 16px;
}
.project-card-description {
  min-height: 38px;
  margin-top: 7px;
  overflow: hidden;
  color: #7787a0;
  font-size: 11px;
  line-height: 1.6;
}
.project-progress-label {
  margin-top: auto;
  color: #718098;
  font-size: 11px;
}
.project-progress-label strong {
  color: #40536c;
}
.project-progress {
  display: block;
  height: 6px;
  margin: 8px 0 12px;
  overflow: hidden;
  border-radius: 6px;
  background: #edf1f8;
}
.project-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tf-brand);
}
.project-card-foot {
  padding-top: 11px;
  border-top: 1px solid #edf1f6;
  color: #8795aa;
  font-size: 10px;
}
.project-create-card {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: 235px;
  border: 1px dashed #bdcef8;
  border-radius: 14px;
  background: #eef3ff;
  color: var(--tf-brand);
}
.project-create-card > span {
  display: grid;
  place-items: center;
  width: 45px;
  height: 45px;
  margin-bottom: 11px;
  border-radius: 50%;
  background: #dce7ff;
  font-size: 25px;
}
.project-create-card strong {
  font-size: 14px;
}
.project-create-card small {
  margin-top: 9px;
  color: #8aa0c5;
  font-size: 11px;
}
.project-footer-note {
  margin-top: 20px;
}
.project-owner-hint {
  margin-bottom: 22px;
}
@media (max-width: 1150px) {
  .project-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .project-grid {
    grid-template-columns: 1fr;
    gap: 13px;
  }
  .project-filters {
    width: 100%;
  }
  .project-filters button {
    flex: 1;
  }
}
</style>

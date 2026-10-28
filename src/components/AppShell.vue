<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatApiError } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { listProjects, type ProjectView } from '../views/projects/projectApi'
import NotificationCenter from '../views/notifications/NotificationCenter.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const recentProjects = ref<ProjectView[]>([])
const recentError = ref('')
const shellError = ref('')
const isMenuOpen = ref(false)
const isSigningOut = ref(false)

const section = computed(() => {
  if (route.name === 'home') return '项目'
  if (route.name === 'admin-users') return '账号管理'
  if (route.name === 'insights') return '统计概览'
  if (route.name === 'project-dashboard') return '项目统计'
  return '项目详情'
})
const avatar = computed(() => auth.user?.displayName?.slice(0, 1) || '我')

async function loadRecent(): Promise<void> {
  recentError.value = ''
  try {
    const result = await listProjects(1, 'ACTIVE')
    recentProjects.value = result.items.slice(0, 3)
  } catch (error) {
    recentProjects.value = []
    recentError.value = formatApiError(error)
  }
}

async function signOut(): Promise<void> {
  if (isSigningOut.value) return
  isSigningOut.value = true
  shellError.value = ''
  try {
    await auth.logout()
  } catch (error) {
    shellError.value = formatApiError(error)
  } finally {
    isSigningOut.value = false
    await router.replace({ name: 'login' })
  }
}

function closeMenu(): void {
  isMenuOpen.value = false
}

onMounted(() => {
  void loadRecent()
})
watch(
  () => route.fullPath,
  () => {
    closeMenu()
    void loadRecent()
  },
)
</script>

<template>
  <div class="tf-shell">
    <button
      v-if="isMenuOpen"
      class="tf-mobile-scrim"
      type="button"
      aria-label="关闭导航"
      @click="closeMenu"
    />
    <aside class="tf-sidebar" :class="{ 'is-open': isMenuOpen }" aria-label="主导航">
      <RouterLink class="tf-brand" :to="{ name: 'home' }" @click="closeMenu">
        <span class="tf-brand-mark">T</span>
        <span><strong>TeamFlow</strong><small>项目协作空间</small></span>
      </RouterLink>

      <div class="tf-side-caption">工作空间</div>
      <nav class="tf-side-nav">
        <RouterLink
          class="tf-side-link"
          :class="{ active: route.name === 'home' || route.name === 'project-detail' }"
          :to="{ name: 'home' }"
          @click="closeMenu"
        >
          <span class="tf-side-symbol" aria-hidden="true">▦</span><span>项目空间</span>
        </RouterLink>
        <RouterLink
          class="tf-side-link"
          :class="{ active: route.name === 'insights' }"
          :to="{ name: 'insights' }"
          @click="closeMenu"
        >
          <span class="tf-side-symbol" aria-hidden="true">▤</span><span>统计概览</span
          ><small>P1</small>
        </RouterLink>
        <RouterLink
          v-if="auth.user?.systemAdmin"
          class="tf-side-link"
          :class="{ active: route.name === 'admin-users' }"
          :to="{ name: 'admin-users' }"
          @click="closeMenu"
        >
          <span class="tf-side-symbol" aria-hidden="true">♙</span><span>账号管理</span>
        </RouterLink>
      </nav>

      <div class="tf-side-caption tf-recent-caption">最近项目</div>
      <nav class="tf-recent-list" aria-label="最近项目">
        <RouterLink
          v-for="(project, index) in recentProjects"
          :key="project.id"
          :to="{ name: 'project-detail', params: { id: project.id } }"
          @click="closeMenu"
        >
          <i :class="`tone-${index}`" />{{ project.name }}
        </RouterLink>
        <p v-if="recentError" class="tf-recent-error">最近项目加载失败</p>
        <p v-else-if="recentProjects.length === 0" class="tf-recent-error">暂无进行中的项目</p>
      </nav>

      <div class="tf-side-bottom">
        <div class="tf-help-card">
          <strong>需要帮助？</strong>
          <p>查看项目协作与权限说明</p>
          <span>请联系项目负责人</span>
        </div>
      </div>
    </aside>

    <div class="tf-workspace">
      <header class="tf-topbar">
        <div class="tf-topbar-left">
          <button
            class="tf-menu-toggle"
            type="button"
            aria-label="打开导航"
            @click="isMenuOpen = true"
          >
            ☰
          </button>
          <span class="tf-mobile-brand"
            ><span class="tf-brand-mark">T</span><strong>TeamFlow</strong></span
          >
          <RouterLink :to="{ name: 'home' }">工作空间</RouterLink><span>/</span
          ><strong>{{ section }}</strong>
        </div>
        <div class="tf-topbar-right">
          <NotificationCenter />
          <span class="tf-topbar-divider" />
          <details class="tf-profile-menu">
            <summary>
              <span class="tf-avatar">{{ avatar }}</span
              ><span class="tf-profile-copy"
                ><strong>{{ auth.user?.displayName }}</strong
                ><small>{{ auth.user?.systemAdmin ? '系统管理员' : '项目成员' }}</small></span
              ><span aria-hidden="true">⌄</span>
            </summary>
            <div class="tf-profile-dropdown">
              <button type="button" :disabled="isSigningOut" @click="signOut">退出登录</button>
            </div>
          </details>
        </div>
      </header>
      <div v-if="shellError" class="tf-shell-error" role="alert">{{ shellError }}</div>
      <div class="tf-shell-content"><slot /></div>
      <nav class="tf-mobile-bottom" aria-label="移动导航">
        <RouterLink :to="{ name: 'home' }"
          ><span aria-hidden="true">▦</span><small>项目</small></RouterLink
        >
        <RouterLink :to="{ name: 'insights' }"
          ><span aria-hidden="true">▤</span><small>统计</small></RouterLink
        >
        <button type="button" @click="isMenuOpen = true">
          <span aria-hidden="true">♙</span><small>我的</small>
        </button>
      </nav>
    </div>
  </div>
</template>

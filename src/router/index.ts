import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
const LoginView = () => import('../views/auth/LoginView.vue')
const HomeView = () => import('../views/projects/HomeView.vue')
const ProjectDetailView = () => import('../views/projects/ProjectDetailView.vue')
const UserAdminView = () => import('../views/admin/UserAdminView.vue')
const ProjectDashboardView = () => import('../views/dashboard/ProjectDashboardView.vue')
const InsightsView = () => import('../views/dashboard/InsightsView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/insights', name: 'insights', component: InsightsView, meta: { requiresAuth: true } },
    {
      path: '/projects/:id',
      name: 'project-detail',
      component: ProjectDetailView,
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/:id/dashboard',
      name: 'project-dashboard',
      component: ProjectDashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: UserAdminView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) await auth.restore()
  if (to.meta.requiresAuth && !auth.token) {
    return { name: 'login' }
  }
  if (to.meta.requiresAdmin && !auth.user?.systemAdmin) return { name: 'home' }
  if (to.name === 'login' && auth.token) {
    return { name: 'home' }
  }
  return true
})

export default router

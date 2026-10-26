import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/auth/LoginView.vue'
import HomeView from '../views/projects/HomeView.vue'
import ProjectDetailView from '../views/projects/ProjectDetailView.vue'
import UserAdminView from '../views/admin/UserAdminView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    {
      path: '/projects/:id',
      name: 'project-detail',
      component: ProjectDetailView,
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

import { createRouter, createWebHistory } from 'vue-router'
import PublicView from '../views/PublicView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'PublicView',
      component: PublicView
    },
    {
      path: '/registro-interno-agb',
      name: 'Register',
      component: () => import('../views/Register.vue')
    },
    {
      path: '/admin',
      name: 'Dashboard',
      component: () => import('../views/Dashboard.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/admin/pendientes',
      name: 'PendingUsers',
      component: () => import('../views/PendingUsers.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/proyectos',
      name: 'ProjectList',
      component: () => import('../views/ProjectList.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/proyectos/:id',
      name: 'ProjectDetail',
      component: () => import('../views/ProjectDetail.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  
  // Esperar a que Firebase se inicialice antes de evaluar rutas
  if (!authStore.isInitialized) {
    await new Promise<void>((resolve) => {
      const unwatch = authStore.$subscribe((_mutation, state) => {
        if (state.isInitialized) {
          unwatch()
          resolve()
        }
      })
    })
  }

  if (to.meta.requiresAuth) {
    if (!authStore.user) {
      return next('/registro-interno-agb')
    }
    
    // Verificamos claim 'activo' para dejar pasar al admin general
    if (!authStore.claims?.activo) {
      alert('Tu cuenta está pendiente de aprobación por un Superadmin.');
      authStore.logout();
      return next('/')
    }

    if (to.meta.requiresAdmin && authStore.claims?.role !== 'ADMIN') {
      alert('Acceso denegado. Se requiere rol de Administrador.');
      return next('/admin')
    }
  }

  next()
})

export default router

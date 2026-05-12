import { createRouter, createWebHistory } from 'vue-router'
import PublicView from '../views/PublicView.vue'
import AdminLayout from '../layouts/AdminLayout.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // --- Rutas públicas ---
    {
      path: '/',
      name: 'PublicView',
      component: PublicView
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/registro-interno-agb',
      name: 'Register',
      component: () => import('../views/Register.vue')
    },
    {
      path: '/comunicados',
      name: 'ComunicadosPublic',
      component: () => import('../views/ComunicadosPublic.vue')
    },

    // --- Rutas de administración (protegidas) ---
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue')
        },
        {
          path: 'usuarios',
          name: 'AdminUsers',
          component: () => import('../views/admin/AdminUsers.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'proyectos',
          name: 'ProjectList',
          component: () => import('../views/ProjectList.vue')
        },
        {
          path: 'proyectos/:id',
          name: 'ProjectDetail',
          component: () => import('../views/ProjectDetail.vue')
        },
        {
          path: 'comunicados',
          name: 'ComunicadosAdmin',
          component: () => import('../views/admin/ComunicadosAdmin.vue'),
          meta: { requiresAdmin: true }
        }
      ]
    },

    // --- Redirects para compatibilidad con URLs antiguas ---
    { path: '/proyectos', redirect: '/admin/proyectos' },
    { path: '/proyectos/:id', redirect: (to) => `/admin/proyectos/${to.params.id}` },
    { path: '/admin/pendientes', redirect: '/admin/usuarios' }
  ]
})

router.beforeEach(async (to, _from) => {
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
      return '/login'
    }

    // Verificamos claim 'activo' para dejar pasar al admin general
    if (!authStore.claims?.activo) {
      alert('Tu cuenta está pendiente de aprobación por un Superadmin.');
      authStore.logout();
      return '/'
    }

    if (to.meta.requiresAdmin && authStore.claims?.role !== 'ADMIN') {
      alert('Acceso denegado. Se requiere rol de Administrador.');
      return '/admin'
    }
  }
})

export default router

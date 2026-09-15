import { createRouter, createWebHistory } from 'vue-router'
import PublicLayout from '../layouts/PublicLayout.vue'
import AdminLayout from '../layouts/AdminLayout.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (to, _from, savedPosition) => {
    if (savedPosition) return savedPosition
    // Permite enlazar secciones internas, por ejemplo /nosotros#directiva
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
  routes: [
    // --- Sitio institucional público ---
    // Todas cuelgan de PublicLayout, que aporta el encabezado de navegación y
    // el pie de página con la identidad legal de la organización.
    {
      path: '/',
      component: PublicLayout,
      children: [
        {
          path: '',
          name: 'Home',
          component: () => import('../views/Home.vue')
        },
        {
          path: 'nosotros',
          name: 'About',
          component: () => import('../views/About.vue')
        },
        {
          path: 'proyectos',
          name: 'PublicProjects',
          component: () => import('../views/PublicProjects.vue')
        },
        {
          path: 'transparencia',
          name: 'Transparency',
          component: () => import('../views/Transparency.vue')
        },
        {
          path: 'comunicados',
          name: 'PublicAnnouncements',
          component: () => import('../views/ComunicadosPublic.vue')
        },
        {
          path: 'contacto',
          name: 'Contact',
          component: () => import('../views/Contact.vue')
        },
        {
          path: 'login',
          name: 'Login',
          component: () => import('../views/Login.vue')
        },
        {
          path: 'registro-interno-agb',
          name: 'Register',
          component: () => import('../views/Register.vue')
        },
        {
          path: 'validar/:uuid',
          name: 'ValidarDocumento',
          component: () => import('../views/ValidarDocumento.vue')
        }
      ]
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
        },
        {
          path: 'documentos',
          name: 'DocumentosAdmin',
          component: () => import('../views/admin/DocumentosAdmin.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'libro-balance',
          name: 'BalanceBook',
          component: () => import('../views/admin/BalanceBook.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'mensajes',
          name: 'AdminMessages',
          component: () => import('../views/admin/AdminMessages.vue'),
          meta: { requiresAdmin: true }
        }
      ]
    },

    // --- Redirects para compatibilidad con URLs antiguas ---
    // El listado público de proyectos vive ahora en /proyectos; las URLs antiguas
    // con identificador siguen apuntando al detalle del panel de administración.
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

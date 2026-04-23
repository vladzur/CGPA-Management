import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard
    },
    {
      path: '/proyectos',
      name: 'ProjectList',
      component: () => import('../views/ProjectList.vue')
    },
    {
      path: '/proyectos/:id',
      name: 'ProjectDetail',
      component: () => import('../views/ProjectDetail.vue')
    }
  ]
})

export default router

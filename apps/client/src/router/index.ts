import { createRouter, createWebHistory } from 'vue-router'
import PublicView from '../views/PublicView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'PublicView',
      component: PublicView
    },
    {
      path: '/admin',
      name: 'Dashboard',
      component: () => import('../views/Dashboard.vue')
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

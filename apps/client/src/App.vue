<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

// Solo mostrar nav pública en rutas que no son de administración
const showPublicNav = computed(() => !route.path.startsWith('/admin'))
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <!-- Navbar para rutas públicas -->
    <div v-if="showPublicNav" class="navbar bg-base-100 shadow-sm">
      <div class="flex-1">
        <router-link to="/" class="btn btn-ghost normal-case text-xl">Transparencia CGPA</router-link>
      </div>
      <div class="flex-none">
        <ul class="menu menu-horizontal px-1">
          <li><router-link to="/">Transparencia</router-link></li>
          <li><router-link to="/comunicados">Comunicados</router-link></li>
        </ul>
      </div>
    </div>

    <!-- Contenido principal: AdminLayout para /admin/*, vistas públicas para el resto -->
    <RouterView />
  </div>
</template>

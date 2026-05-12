<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isAdmin = computed(() => authStore.claims?.role === 'ADMIN');

interface NavItem {
  to: string;
  label: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/proyectos', label: 'Proyectos' },
  { to: '/admin/comunicados', label: 'Comunicados', adminOnly: true },
  { to: '/admin/usuarios', label: 'Usuarios', adminOnly: true },
];

const filteredNavItems = computed(() =>
  navItems.filter((item) => !item.adminOnly || isAdmin.value)
);

const isActive = (to: string) => {
  if (to === '/admin') {
    return route.path === '/admin';
  }
  return route.path.startsWith(to);
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <!-- Navbar de administración -->
    <div class="navbar bg-base-100 shadow-sm sticky top-0 z-50">
      <div class="flex-1">
        <router-link to="/admin" class="btn btn-ghost normal-case text-xl gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          CGPA Admin
        </router-link>
      </div>

      <!-- Menú desktop -->
      <div class="flex-none hidden md:flex">
        <ul class="menu menu-horizontal px-1 gap-1">
          <li v-for="item in filteredNavItems" :key="item.to">
            <router-link
              :to="item.to"
              :class="{ 'active bg-primary/10 text-primary font-semibold': isActive(item.to) }"
            >
              {{ item.label }}
            </router-link>
          </li>
        </ul>
      </div>

      <!-- Menú mobile -->
      <div class="flex-none md:hidden">
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-square btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-5 h-5 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </label>
          <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <li v-for="item in filteredNavItems" :key="item.to">
              <router-link
                :to="item.to"
                :class="{ 'active bg-primary/10 text-primary font-semibold': isActive(item.to) }"
              >
                {{ item.label }}
              </router-link>
            </li>
            <div class="divider my-1"></div>
            <li>
              <button @click="handleLogout" class="text-error">
                Cerrar Sesión
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Botón de logout desktop -->
      <div class="flex-none hidden md:flex ml-2">
        <button @click="handleLogout" class="btn btn-ghost btn-sm text-error gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Salir
        </button>
      </div>
    </div>

    <!-- Contenido de las rutas anidadas -->
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <!-- Navbar simple -->
    <div class="navbar bg-base-100 shadow-sm">
      <div class="flex-1">
        <a class="btn btn-ghost normal-case text-xl">Transparencia CGPA</a>
      </div>
      <div class="flex-none hidden md:flex">
        <ul class="menu menu-horizontal px-1">
          <li><router-link to="/">Dashboard</router-link></li>
          <li><router-link to="/proyectos">Proyectos</router-link></li>
        </ul>
      </div>
      <div class="flex-none md:hidden">
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-square btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-5 h-5 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </label>
          <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <li><router-link to="/">Dashboard</router-link></li>
            <li><router-link to="/proyectos">Proyectos</router-link></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Contenido principal -->
    <RouterView />
  </div>
</template>

<script setup lang="ts">
/**
 * Layout de todas las páginas públicas del sitio institucional.
 * Contiene el encabezado de navegación y el pie de página con la identidad legal
 * de la organización, que es lo que permite a un visitante (y a los revisores de
 * Google) asociar el dominio con el Centro General de Padres y Apoderados.
 */
import { RouterLink, RouterView, useRoute } from 'vue-router';
import logoUrl from '../assets/logo-cgpa.png';
import {
  ORGANIZATION,
  PENDING_LABEL,
  buildLegalIdentityStatement,
  formatAddress,
} from '../content/institutional';
import { PUBLIC_ROUTES } from '../content/public-routes';

const route = useRoute();

const currentYear = new Date().getFullYear();
const legalIdentity = buildLegalIdentityStatement();
const address = formatAddress();
const contactEmail = ORGANIZATION.contact.email ?? PENDING_LABEL;
const contactPhone = ORGANIZATION.contact.phone ?? PENDING_LABEL;

const isActive = (path: string): boolean =>
  path === '/' ? route.path === '/' : route.path.startsWith(path);
</script>

<template>
  <div class="min-h-screen flex flex-col bg-base-200">
    <!-- Encabezado institucional -->
    <header class="navbar bg-base-100 shadow-sm sticky top-0 z-50 gap-2">
      <div class="flex-1 min-w-0">
        <RouterLink
          to="/"
          class="btn btn-ghost normal-case gap-3 h-auto py-2 px-2 text-left"
        >
          <img
            :src="logoUrl"
            alt="Escudo del Centro General de Padres y Apoderados Liceo Alexander Graham Bell"
            class="h-12 w-12 shrink-0"
          />
          <span class="flex flex-col items-start leading-tight min-w-0">
            <span class="text-lg font-bold">{{ ORGANIZATION.shortName }}</span>
            <span class="text-[11px] font-normal opacity-70 hidden xl:block">
              {{ ORGANIZATION.legalName }}
            </span>
          </span>
        </RouterLink>
      </div>

      <!-- Navegación de escritorio -->
      <nav class="flex-none hidden lg:flex" aria-label="Navegación principal">
        <ul class="menu menu-horizontal px-1 gap-1">
          <li v-for="item in PUBLIC_ROUTES" :key="item.path">
            <RouterLink
              :to="item.path"
              :class="{ 'active bg-primary/10 text-primary font-semibold': isActive(item.path) }"
            >
              {{ item.navLabel }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div class="flex-none hidden lg:flex ml-2">
        <RouterLink to="/login" class="btn btn-outline btn-sm">
          Acceso directiva
        </RouterLink>
      </div>

      <!-- Navegación móvil -->
      <div class="flex-none lg:hidden">
        <details class="dropdown dropdown-end">
          <summary class="btn btn-square btn-ghost">
            <span class="sr-only">Abrir menú de navegación</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="inline-block w-5 h-5 stroke-current"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </summary>
          <ul
            class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-60"
          >
            <li v-for="item in PUBLIC_ROUTES" :key="item.path">
              <RouterLink
                :to="item.path"
                :class="{ 'active bg-primary/10 text-primary font-semibold': isActive(item.path) }"
              >
                {{ item.navLabel }}
              </RouterLink>
            </li>
            <div class="divider my-1"></div>
            <li>
              <RouterLink to="/login">Acceso directiva</RouterLink>
            </li>
          </ul>
        </details>
      </div>
    </header>

    <!-- Contenido de la ruta -->
    <main class="flex-1">
      <RouterView />
    </main>

    <!-- Pie de página con identidad legal -->
    <footer class="bg-neutral text-neutral-content mt-auto">
      <div class="container mx-auto px-4 md:px-8 py-10">
        <div class="grid gap-8 md:grid-cols-3">
          <div>
            <div class="flex items-center gap-3 mb-4">
              <img :src="logoUrl" alt="" class="h-14 w-14" aria-hidden="true" />
              <span class="text-lg font-bold leading-tight">
                {{ ORGANIZATION.shortName }}
              </span>
            </div>
            <p class="text-sm opacity-90">{{ ORGANIZATION.legalName }}</p>
            <p class="text-sm opacity-80 mt-2">{{ legalIdentity }}</p>
          </div>

          <div>
            <h2 class="footer-title opacity-100 mb-3">Domicilio y contacto</h2>
            <p class="text-sm opacity-90">{{ address }}</p>
            <ul class="mt-3 space-y-1 text-sm opacity-90">
              <li>
                Correo:
                <a
                  v-if="ORGANIZATION.contact.email"
                  :href="`mailto:${ORGANIZATION.contact.email}`"
                  class="link link-hover"
                >
                  {{ contactEmail }}
                </a>
                <span v-else>{{ contactEmail }}</span>
              </li>
              <li>Teléfono: {{ contactPhone }}</li>
            </ul>
          </div>

          <div>
            <h2 class="footer-title opacity-100 mb-3">Sitio</h2>
            <ul class="text-sm space-y-1">
              <li v-for="item in PUBLIC_ROUTES" :key="item.path">
                <RouterLink :to="item.path" class="link link-hover opacity-90">
                  {{ item.navLabel }}
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="border-t border-white/10">
        <div
          class="container mx-auto px-4 md:px-8 py-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between text-xs opacity-70"
        >
          <span>© {{ currentYear }} {{ ORGANIZATION.legalName }}</span>
          <span>Sitio oficial: cgpagrahambell.cl</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * Portada del sitio institucional.
 *
 * Presenta de forma explícita el nombre legal, la sigla, la personalidad jurídica
 * y el domicilio de la organización (requisitos de transparencia de Google for
 * Nonprofits), junto con sus programas, objetivos y el resumen de rendición de cuentas.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import logoUrl from '../assets/logo-cgpa.png';
import apiClient from '../plugins/axios';
import { usePageMeta } from '../composables/usePageMeta';
import {
  MISSION,
  OBJECTIVES,
  ORGANIZATION,
  PROGRAMS,
  buildLegalIdentityStatement,
  formatAddress,
} from '../content/institutional';
import { useFinanzasStore } from '../stores/finanzas';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';

usePageMeta('Home');

interface Announcement {
  id: string;
  titulo: string;
  contenido: string;
  fecha_publicacion: unknown;
}

const store = useFinanzasStore();

const announcements = ref<Announcement[]>([]);

const balance = computed(() => store.institucion?.saldo_total ?? 0);
const lastUpdate = computed(() => store.institucion?.ultima_actualizacion);
const legalIdentity = buildLegalIdentityStatement();
const address = formatAddress();

/** Se listan solo los últimos comunicados publicados por la directiva. */
const loadAnnouncements = async (): Promise<void> => {
  try {
    const { data } = await apiClient.get<Announcement[]>('/comunicados/publicos');
    announcements.value = data.slice(0, 3);
  } catch {
    // Si la API no responde, la portada mantiene el resto de su contenido.
    announcements.value = [];
  }
};

onMounted(() => {
  store.init();
  loadAnnouncements();
});

onUnmounted(() => {
  store.cleanup();
});
</script>

<template>
  <div>
    <!-- Presentación institucional -->
    <section
      class="bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white"
    >
      <div class="container mx-auto px-4 md:px-8 py-14 md:py-20">
        <div class="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <img
            :src="logoUrl"
            alt="Escudo del Centro General de Padres y Apoderados Liceo Alexander Graham Bell"
            class="h-40 w-40 md:h-52 md:w-52 shrink-0 drop-shadow-lg"
          />

          <div class="text-center md:text-left">
            <p class="uppercase tracking-wide text-sm font-semibold opacity-90">
              Sitio oficial
            </p>
            <h1 class="text-3xl md:text-5xl font-bold mt-2 leading-tight">
              {{ ORGANIZATION.shortName }}
            </h1>
            <p class="text-lg md:text-xl mt-3 opacity-95">
              {{ ORGANIZATION.legalName }}
            </p>
            <p class="mt-5 text-base md:text-lg opacity-90 max-w-3xl">
              {{ MISSION }}
            </p>

            <div class="mt-8 flex flex-wrap justify-center md:justify-start gap-3">
              <RouterLink to="/nosotros" class="btn btn-accent">
                Conocer el CGPA
              </RouterLink>
              <RouterLink to="/transparencia" class="btn btn-outline border-white/70 text-white hover:bg-white hover:text-liceo-primary">
                Ver transparencia
              </RouterLink>
              <RouterLink to="/contacto" class="btn btn-ghost text-white">
                Contacto
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Identidad legal: permite asociar el dominio con la organización registrada -->
    <section class="bg-base-100 border-b border-base-200">
      <div class="container mx-auto px-4 md:px-8 py-6">
        <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <dt class="opacity-60">Organización</dt>
            <dd class="font-semibold">{{ ORGANIZATION.legalName }}</dd>
          </div>
          <div>
            <dt class="opacity-60">Personalidad jurídica</dt>
            <dd class="font-semibold">
              N° {{ ORGANIZATION.legalPersonality.number }}
              ({{ ORGANIZATION.legalPersonality.grantDate }}) ·
              {{ ORGANIZATION.legalPersonality.status }}
            </dd>
          </div>
          <div>
            <dt class="opacity-60">Naturaleza</dt>
            <dd class="font-semibold">{{ ORGANIZATION.nature }}</dd>
          </div>
          <div>
            <dt class="opacity-60">Domicilio</dt>
            <dd class="font-semibold">{{ address }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <div class="container mx-auto px-4 md:px-8 py-12 space-y-14">
      <!-- Programas y servicios -->
      <section>
        <h2 class="text-2xl md:text-3xl font-bold text-base-content mb-3">
          Qué hacemos
        </h2>
        <p class="text-base-content/70 max-w-3xl mb-8">
          El Centro General de Padres y Apoderados administra los aportes de las
          familias del Liceo Alexander Graham Bell y los destina a programas
          acordados con la comunidad escolar.
        </p>

        <div class="grid gap-6 md:grid-cols-3">
          <article
            v-for="program in PROGRAMS"
            :key="program.id"
            class="card bg-base-100 shadow-lg border border-base-200"
          >
            <div class="card-body">
              <h3 class="card-title text-lg">{{ program.title }}</h3>
              <p class="text-sm text-base-content/70">{{ program.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <!-- Objetivos -->
      <section>
        <h2 class="text-2xl md:text-3xl font-bold text-base-content mb-6">
          Nuestros objetivos
        </h2>
        <ul class="grid gap-3 md:grid-cols-2">
          <li
            v-for="objective in OBJECTIVES"
            :key="objective"
            class="flex items-start gap-3 bg-base-100 rounded-xl border border-base-200 p-4"
          >
            <span class="text-success mt-0.5" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <span class="text-sm text-base-content/80">{{ objective }}</span>
          </li>
        </ul>
      </section>

      <!-- Resumen de rendición de cuentas -->
      <section class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 class="text-2xl font-bold text-base-content">
              Rendición de cuentas
            </h2>
            <p class="text-base-content/70 mt-2 max-w-2xl">
              Publicamos el saldo disponible, cada ingreso y cada egreso con su
              respaldo, y el avance de los proyectos financiados. El detalle
              completo está disponible en la sección de transparencia.
            </p>
            <p class="text-xs text-base-content/60 mt-3">
              Última actualización: {{ formatDateTime(lastUpdate) }}
            </p>
          </div>

          <div class="text-center md:text-right shrink-0">
            <p class="text-sm text-base-content/60">Fondo general disponible</p>
            <p
              v-if="store.loading"
              class="loading loading-spinner loading-lg text-primary mt-2"
            ></p>
            <p v-else class="text-4xl font-bold text-liceo-primary mt-1">
              {{ formatCurrency(balance) }}
            </p>
            <RouterLink to="/transparencia" class="btn btn-sm btn-primary mt-4">
              Ver el detalle
            </RouterLink>
          </div>
        </div>
      </section>

      <!-- Últimos comunicados -->
      <section>
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6"
        >
          <h2 class="text-2xl md:text-3xl font-bold text-base-content">
            Últimos comunicados
          </h2>
          <RouterLink to="/comunicados" class="btn btn-ghost btn-sm">
            Ver todos
          </RouterLink>
        </div>

        <div v-if="announcements.length > 0" class="grid gap-6 md:grid-cols-3">
          <article
            v-for="announcement in announcements"
            :key="announcement.id"
            class="card bg-base-100 shadow-lg border border-base-200"
          >
            <div class="card-body">
              <h3 class="card-title text-base">{{ announcement.titulo }}</h3>
              <p class="text-xs text-base-content/60">
                {{ formatDate(announcement.fecha_publicacion) }}
              </p>
              <p class="text-sm text-base-content/70 line-clamp-4 mt-2">
                {{ announcement.contenido }}
              </p>
              <div class="card-actions mt-4">
                <RouterLink
                  to="/comunicados"
                  class="link link-primary text-sm"
                >
                  Leer el comunicado
                </RouterLink>
              </div>
            </div>
          </article>
        </div>

        <p v-else class="text-base-content/60 text-sm">
          La directiva publica sus comunicados oficiales en la sección
          <RouterLink to="/comunicados" class="link link-primary">
            Comunicados</RouterLink
          >.
        </p>
      </section>

      <!-- Invitación al contacto -->
      <section
        class="rounded-2xl bg-liceo-primary text-white p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
      >
        <div>
          <h2 class="text-2xl font-bold">¿Necesitas comunicarte con la directiva?</h2>
          <p class="opacity-90 mt-2 max-w-2xl">
            {{ ORGANIZATION.contact.officeHours }}
          </p>
          <p class="opacity-90 mt-2 text-sm">{{ legalIdentity }}</p>
        </div>
        <RouterLink to="/contacto" class="btn btn-accent shrink-0">
          Ir a contacto
        </RouterLink>
      </section>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

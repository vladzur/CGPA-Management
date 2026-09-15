<script setup lang="ts">
/**
 * Listado público de proyectos financiados por el CGPA.
 *
 * Antes esta información solo era visible en el panel de administración; ahora
 * forma parte del sitio institucional para que cualquier apoderado pueda revisar
 * en qué se invierten los recursos, que es uno de los puntos que Google verifica
 * al evaluar el sitio de una organización sin fines de lucro.
 */
import { computed, onMounted, onUnmounted } from 'vue';
import type { Proyecto } from '@cgpa/shared';
import { usePageMeta } from '../composables/usePageMeta';
import { ORGANIZATION } from '../content/institutional';
import { useFinanzasStore } from '../stores/finanzas';
import { executionPercentage, formatCurrency, formatDate } from '../utils/format';

usePageMeta('PublicProjects');

type ProjectWithId = Proyecto & { id: string };

/** Etiquetas legibles para los estados definidos en `@cgpa/shared`. */
const STATUS_LABELS: Record<Proyecto['estado'], string> = {
  PLANIFICACION: 'En planificación',
  EN_CURSO: 'En curso',
  FINALIZADO: 'Finalizado',
};

const STATUS_BADGES: Record<Proyecto['estado'], string> = {
  PLANIFICACION: 'badge-warning',
  EN_CURSO: 'badge-info',
  FINALIZADO: 'badge-success',
};

const store = useFinanzasStore();

const projects = computed<ProjectWithId[]>(() => store.proyectos as ProjectWithId[]);

const totals = computed(() => {
  return projects.value.reduce(
    (accumulator, project) => ({
      budget: accumulator.budget + (project.presupuesto_estimado ?? 0),
      collected: accumulator.collected + (project.monto_recaudado ?? 0),
      executed: accumulator.executed + (project.monto_ejecutado ?? 0),
    }),
    { budget: 0, collected: 0, executed: 0 },
  );
});

onMounted(() => {
  store.init();
});

onUnmounted(() => {
  store.cleanup();
});
</script>

<template>
  <div>
    <section class="bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white">
      <div class="container mx-auto px-4 md:px-8 py-12 md:py-16">
        <h1 class="text-3xl md:text-4xl font-bold">Proyectos</h1>
        <p class="mt-3 max-w-3xl opacity-95">
          Proyectos de infraestructura, equipamiento y material educativo
          financiados con los aportes de las familias del Liceo Alexander Graham
          Bell. Cada proyecto se acuerda con la comunidad escolar y se rinde cuenta
          de su ejecución presupuestaria durante el período
          {{ ORGANIZATION.currentPeriod }}.
        </p>
      </div>
    </section>

    <div class="container mx-auto px-4 md:px-8 py-12 space-y-10">
      <!-- Resumen general -->
      <section
        v-if="projects.length > 0"
        class="grid gap-4 sm:grid-cols-3"
      >
        <div class="card bg-base-100 shadow-md border border-base-200">
          <div class="card-body py-5">
            <p class="text-sm text-base-content/60">Presupuesto total</p>
            <p class="text-2xl font-bold">{{ formatCurrency(totals.budget) }}</p>
          </div>
        </div>
        <div class="card bg-base-100 shadow-md border border-base-200">
          <div class="card-body py-5">
            <p class="text-sm text-base-content/60">Recaudado</p>
            <p class="text-2xl font-bold text-success">
              {{ formatCurrency(totals.collected) }}
            </p>
          </div>
        </div>
        <div class="card bg-base-100 shadow-md border border-base-200">
          <div class="card-body py-5">
            <p class="text-sm text-base-content/60">Ejecutado</p>
            <p class="text-2xl font-bold text-liceo-primary">
              {{ formatCurrency(totals.executed) }}
            </p>
          </div>
        </div>
      </section>

      <!-- Cargando -->
      <div v-if="store.loading" class="flex justify-center py-16">
        <span class="loading loading-bars loading-lg text-primary"></span>
      </div>

      <!-- Sin proyectos -->
      <div
        v-else-if="projects.length === 0"
        class="card bg-base-100 border border-dashed border-base-300"
      >
        <div class="card-body items-center text-center py-14">
          <h2 class="card-title">Aún no hay proyectos publicados</h2>
          <p class="text-base-content/70 max-w-xl">
            Los proyectos se publican una vez que la asamblea de socios los aprueba
            y la directiva define su presupuesto. Cuando existan proyectos vigentes
            en el período {{ ORGANIZATION.currentPeriod }}, aparecerán en esta página
            con su avance y su ejecución presupuestaria.
          </p>
        </div>
      </div>

      <!-- Listado -->
      <div v-else class="grid gap-6 md:grid-cols-2">
        <article
          v-for="project in projects"
          :key="project.id"
          class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden"
        >
          <div
            class="h-2 w-full"
            :class="{
              'bg-warning': project.estado === 'PLANIFICACION',
              'bg-info': project.estado === 'EN_CURSO',
              'bg-success': project.estado === 'FINALIZADO',
            }"
          ></div>

          <div class="card-body">
            <div class="flex items-start justify-between gap-4">
              <h2 class="card-title text-xl">{{ project.nombre }}</h2>
              <span
                class="badge whitespace-nowrap"
                :class="STATUS_BADGES[project.estado]"
              >
                {{ STATUS_LABELS[project.estado] }}
              </span>
            </div>

            <p class="text-sm text-base-content/70">{{ project.descripcion }}</p>

            <p class="text-xs text-base-content/60 mt-2">
              Inicio: {{ formatDate(project.fecha_inicio) }}
            </p>

            <div class="mt-4">
              <div class="flex justify-between text-sm font-medium mb-2">
                <span class="text-base-content/80">Ejecución presupuestaria</span>
                <span
                  :class="
                    project.monto_ejecutado > project.presupuesto_estimado
                      ? 'text-error'
                      : 'text-success'
                  "
                >
                  {{
                    executionPercentage(
                      project.monto_ejecutado,
                      project.presupuesto_estimado,
                    )
                  }}%
                </span>
              </div>

              <progress
                class="progress w-full h-3"
                :class="
                  project.monto_ejecutado > project.presupuesto_estimado
                    ? 'progress-error'
                    : 'progress-success bg-base-200'
                "
                :value="project.monto_ejecutado"
                :max="project.presupuesto_estimado || 1"
              ></progress>

              <dl class="grid grid-cols-3 gap-2 mt-4 text-xs">
                <div>
                  <dt class="text-base-content/60">Presupuesto</dt>
                  <dd class="font-semibold">
                    {{ formatCurrency(project.presupuesto_estimado) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-base-content/60">Recaudado</dt>
                  <dd class="font-semibold">
                    {{ formatCurrency(project.monto_recaudado) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-base-content/60">Ejecutado</dt>
                  <dd class="font-semibold">
                    {{ formatCurrency(project.monto_ejecutado) }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </article>
      </div>

      <!-- Cómo se financian los proyectos -->
      <section class="rounded-2xl bg-base-100 border border-base-200 p-8">
        <h2 class="text-xl font-bold mb-4">¿Cómo se financian estos proyectos?</h2>
        <p class="text-base-content/80 max-w-4xl">
          Los recursos provienen de la cuota anual de apoderados, de actividades de
          financiamiento organizadas por la directiva y de donaciones. Cada ingreso y
          cada egreso se publica con su respaldo en la sección de transparencia, y el
          proyecto solo se ejecuta una vez aprobado por la asamblea de socios.
        </p>
      </section>
    </div>
  </div>
</template>

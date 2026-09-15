<script setup lang="ts">
/**
 * Página de transparencia financiera.
 *
 * Recoge el contenido que antes era la portada de la plataforma (saldo del fondo
 * general y detalle de movimientos "Cuentas Claras") y le agrega la explicación
 * de qué se publica y con qué periodicidad. El listado de proyectos se movió a
 * `/proyectos` para mantener esta página enfocada en los movimientos de dinero.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { usePageMeta } from '../composables/usePageMeta';
import { ORGANIZATION } from '../content/institutional';
import { useFinanzasStore } from '../stores/finanzas';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';

usePageMeta('Transparency');

type TransactionFilter = 'TODOS' | 'INGRESO' | 'EGRESO';

const store = useFinanzasStore();
const transactionFilter = ref<TransactionFilter>('TODOS');

const balance = computed(() => store.institucion?.saldo_total ?? 0);
const lastUpdate = computed(() => store.institucion?.ultima_actualizacion);

const filteredTransactions = computed(() => {
  const transactions = store.transacciones ?? [];
  if (transactionFilter.value === 'TODOS') return transactions;
  return transactions.filter(
    (transaction) => transaction.tipo === transactionFilter.value,
  );
});

/** Explica el alcance de la información publicada. */
const disclosureItems = [
  {
    title: 'Qué publicamos',
    description:
      'El saldo del fondo general, cada ingreso y cada egreso con su concepto, y el respaldo digital del documento que lo acredita cuando existe.',
  },
  {
    title: 'Con qué periodicidad',
    description:
      'La información se actualiza al registrar cada movimiento, de modo que el saldo mostrado corresponde al último estado publicado por la tesorería.',
  },
  {
    title: 'Cómo se verifica',
    description:
      'Cada movimiento incluye un sello criptográfico encadenado. Los documentos oficiales emitidos por la directiva se pueden verificar con su código único.',
  },
];

onMounted(() => {
  store.init();
});

onUnmounted(() => {
  store.cleanup();
});
</script>

<template>
  <div>
    <!-- Saldo del fondo general -->
    <section
      class="bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white"
    >
      <div class="container mx-auto px-4 md:px-8 py-14 md:py-20 text-center">
        <p
          class="badge badge-outline border-white/50 text-white/90 py-3 px-4 bg-white/10"
        >
          Transparencia financiera · {{ ORGANIZATION.shortName }}
        </p>

        <h1 class="text-2xl md:text-3xl font-semibold mt-6 opacity-90">
          Fondo general disponible
        </h1>

        <div v-if="store.loading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg text-white"></span>
        </div>
        <div v-else>
          <p class="text-5xl md:text-7xl font-bold tracking-tight mt-4">
            {{ formatCurrency(balance) }}
          </p>
          <p class="text-sm md:text-base opacity-80 mt-4">
            Última actualización: {{ formatDateTime(lastUpdate) }}
          </p>
        </div>
      </div>
    </section>

    <div class="container mx-auto px-4 md:px-8 py-12 space-y-12">
      <!-- Alcance de la información publicada -->
      <section class="grid gap-6 md:grid-cols-3">
        <article
          v-for="item in disclosureItems"
          :key="item.title"
          class="card bg-base-100 shadow-md border border-base-200"
        >
          <div class="card-body">
            <h2 class="card-title text-base">{{ item.title }}</h2>
            <p class="text-sm text-base-content/70">{{ item.description }}</p>
          </div>
        </article>
      </section>

      <!-- Movimientos -->
      <section>
        <div
          class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6"
        >
          <h2 class="text-2xl md:text-3xl font-bold">Cuentas claras</h2>

          <fieldset class="join shadow-sm border-0 p-0 m-0">
            <legend class="sr-only">Filtrar movimientos por tipo</legend>
            <button
              type="button"
              class="join-item btn btn-sm"
              :class="transactionFilter === 'TODOS' ? 'btn-active' : ''"
              @click="transactionFilter = 'TODOS'"
            >
              Todos
            </button>
            <button
              type="button"
              class="join-item btn btn-sm"
              :class="transactionFilter === 'INGRESO' ? 'btn-active text-success' : ''"
              @click="transactionFilter = 'INGRESO'"
            >
              Ingresos
            </button>
            <button
              type="button"
              class="join-item btn btn-sm"
              :class="transactionFilter === 'EGRESO' ? 'btn-active text-error' : ''"
              @click="transactionFilter = 'EGRESO'"
            >
              Egresos
            </button>
          </fieldset>
        </div>

        <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
          <div v-if="store.loading" class="flex justify-center py-12">
            <span class="loading loading-bars loading-lg text-primary"></span>
          </div>

          <div
            v-else-if="filteredTransactions.length === 0"
            class="flex flex-col items-center justify-center py-16 px-4 text-center"
          >
            <h3 class="text-lg font-medium text-base-content/70">
              No hay movimientos para mostrar
            </h3>
            <p class="text-base-content/50 text-sm mt-2 max-w-md">
              La tesorería publica cada movimiento al momento de registrarlo. Si el
              filtro seleccionado no arroja resultados, aún no existen movimientos de
              ese tipo en el período {{ ORGANIZATION.currentPeriod }}.
            </p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead class="bg-base-200/50 text-base-content/70">
                <tr>
                  <th class="font-semibold py-4">Fecha</th>
                  <th class="font-semibold py-4">Concepto / categoría</th>
                  <th class="font-semibold py-4 text-right">Monto</th>
                  <th class="font-semibold py-4 text-center">Verificado</th>
                  <th class="font-semibold py-4 text-center">Respaldo</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="transaction in filteredTransactions"
                  :key="transaction.id"
                  class="hover:bg-base-200/30 transition-colors"
                >
                  <td class="whitespace-nowrap">
                    <span class="text-sm font-medium">
                      {{ formatDate(transaction.fecha) }}
                    </span>
                  </td>
                  <td>
                    <div class="font-medium text-base-content">
                      {{ transaction.descripcion }}
                    </div>
                    <div class="text-xs text-base-content/60 mt-1 flex items-center gap-2">
                      <span class="badge badge-ghost badge-sm">
                        {{ transaction.categoria }}
                      </span>
                      <span
                        v-if="transaction.proyecto_id"
                        class="badge badge-primary badge-outline badge-sm"
                      >
                        Asociado a proyecto
                      </span>
                    </div>
                  </td>
                  <td class="text-right font-bold whitespace-nowrap">
                    <div
                      :class="
                        transaction.tipo === 'INGRESO' ? 'text-success' : 'text-error'
                      "
                    >
                      <span v-if="transaction.tipo === 'INGRESO'">+</span>
                      <span v-else>-</span>
                      {{ formatCurrency(transaction.monto) }}
                    </div>
                  </td>
                  <td class="text-center">
                    <div
                      v-if="transaction.hash_integridad"
                      class="tooltip tooltip-left"
                      :data-tip="`Registro #${transaction.numero_secuencia} con firma criptográfica verificable`"
                    >
                      <div class="badge badge-success badge-sm gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        Verificado
                      </div>
                    </div>
                    <span v-else class="text-xs text-base-content/30">—</span>
                  </td>
                  <td class="text-center">
                    <a
                      v-if="transaction.respaldo_url"
                      :href="transaction.respaldo_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-circle btn-ghost btn-sm text-primary"
                      title="Ver el respaldo digital del movimiento"
                    >
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
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                    </a>
                    <span v-else class="text-xs text-base-content/30">
                      Sin respaldo adjunto
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Enlaces relacionados -->
      <section class="rounded-2xl bg-base-100 border border-base-200 p-8">
        <h2 class="text-xl font-bold mb-3">Información relacionada</h2>
        <p class="text-base-content/80 max-w-3xl mb-6">
          El detalle de los proyectos financiados y los comunicados oficiales de la
          directiva se publican en sus respectivas secciones.
        </p>
        <div class="flex flex-wrap gap-3">
          <RouterLink to="/proyectos" class="btn btn-outline btn-primary btn-sm">
            Ver proyectos
          </RouterLink>
          <RouterLink to="/comunicados" class="btn btn-outline btn-primary btn-sm">
            Ver comunicados
          </RouterLink>
          <RouterLink to="/nosotros" class="btn btn-outline btn-primary btn-sm">
            Conocer la organización
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

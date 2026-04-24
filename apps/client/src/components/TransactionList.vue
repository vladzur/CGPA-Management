<script setup lang="ts">
import { useFinanzasStore } from '../stores/finanzas';

const store = useFinanzasStore();

const formatearMoneda = (valor: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(valor);
};

// Formatea un Timestamp de Firestore a formato chileno
const formatearFecha = (fechaObj: any) => {
  if (!fechaObj) return '';
  const date = typeof fechaObj.toDate === 'function' ? fechaObj.toDate() : new Date(fechaObj);
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getProyectoNombre = (id?: string) => {
  if (!id) return 'General';
  const proy = store.proyectos.find((p: any) => p.id === id);
  return proy ? proy.nombre : 'General';
};
</script>

<template>
  <div class="mt-8">
    <h2 class="text-2xl font-bold mb-6 text-base-content flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-liceo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      Últimos Movimientos
    </h2>

    <div v-if="store.loading" class="flex justify-center py-10">
      <span class="loading loading-bars loading-lg text-liceo-primary"></span>
    </div>

    <div v-else-if="store.transacciones.length === 0" class="alert shadow-md bg-base-100 border-base-200">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>No hay movimientos registrados recientes.</span>
    </div>

    <div v-else class="overflow-x-auto bg-base-100 rounded-xl shadow-xl border border-base-200">
      <table class="table table-zebra w-full">
        <thead class="bg-base-200/50 text-base-content">
          <tr>
            <th>Fecha</th>
            <th>Categoría</th>
            <th>Descripción</th>
            <th>Proyecto</th>
            <th class="text-right">Monto</th>
            <th class="text-center">Respaldo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in store.transacciones" :key="t.id" class="hover">
            <td class="text-sm font-medium whitespace-nowrap">{{ formatearFecha(t.fecha) }}</td>
            <td>
              <div class="badge badge-outline text-xs" :class="t.tipo === 'INGRESO' ? 'badge-success' : 'badge-error'">
                {{ t.categoria }}
              </div>
            </td>
            <td class="max-w-xs truncate" :title="t.descripcion">{{ t.descripcion }}</td>
            <td class="text-sm text-base-content/70">{{ getProyectoNombre(t.proyecto_id) }}</td>
            <td class="text-right font-bold" :class="t.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'">
              {{ t.tipo === 'INGRESO' ? '+' : '-' }}{{ formatearMoneda(t.monto) }}
            </td>
            <td class="text-center">
              <a v-if="t.respaldo_url" :href="t.respaldo_url" target="_blank" class="btn btn-ghost btn-xs text-liceo-primary" title="Ver comprobante">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
              </a>
              <span v-else class="text-gray-400 text-xs">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

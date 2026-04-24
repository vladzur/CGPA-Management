<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import { useFinanzasStore } from '../stores/finanzas';

const store = useFinanzasStore();

onMounted(() => {
  store.init();
});

onUnmounted(() => {
  store.cleanup();
});

// Helper para formatear moneda (CLP)
const formatearMoneda = (valor: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(valor);
};

// Helper para formatear fecha
const formatearFecha = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

// Helper para formatear fecha y hora para "Última actualización"
const formatearFechaHora = (timestamp: any) => {
  if (!timestamp) return 'No disponible';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const saldoTotal = computed(() => store.institucion?.saldo_total || 0);
const ultimaActualizacion = computed(() => store.institucion?.ultima_actualizacion);

// Filtros de transacciones
const filtroTransacciones = ref('TODOS'); // 'TODOS', 'INGRESO', 'EGRESO'

const transaccionesFiltradas = computed(() => {
  let transacciones = store.transacciones || [];
  if (filtroTransacciones.value !== 'TODOS') {
    transacciones = transacciones.filter((t: any) => t.tipo === filtroTransacciones.value);
  }
  return transacciones;
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-12">
    
    <!-- Hero con el Saldo Total -->
    <div class="hero rounded-3xl bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white shadow-xl overflow-hidden relative">
      <div class="hero-content text-center py-16 md:py-24 w-full relative z-10 flex flex-col items-center">
        <div class="max-w-2xl">
          <div class="badge badge-outline border-white/50 text-white/90 mb-6 py-3 px-4 backdrop-blur-md bg-white/10">
            Transparencia Financiera CGPA
          </div>
          <h1 class="text-3xl md:text-4xl font-semibold mb-4 opacity-90 drop-shadow-md">Fondo General Disponible</h1>
          <div v-if="store.loading" class="loading loading-spinner loading-lg my-6 text-white"></div>
          <div v-else class="flex flex-col items-center">
            <p class="text-5xl md:text-8xl font-bold tracking-tight drop-shadow-lg mb-4">
              {{ formatearMoneda(saldoTotal) }}
            </p>
            <div class="flex items-center gap-2 text-sm md:text-base opacity-80 font-medium bg-black/20 rounded-full px-4 py-2 backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Última actualización: {{ formatearFechaHora(ultimaActualizacion) }}
            </div>
          </div>
        </div>
      </div>
      <!-- Decoración de fondo -->
      <div class="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute top-1/2 left-1/4 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
    </div>

    <!-- Sección de Proyectos -->
    <section>
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 class="text-3xl font-bold text-base-content flex items-center gap-3">
          <div class="p-2 bg-primary/10 rounded-lg text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          Proyectos Activos
        </h2>
      </div>

      <div v-if="store.loading" class="flex justify-center py-12">
        <span class="loading loading-bars loading-lg text-primary"></span>
      </div>
      
      <div v-else-if="store.proyectos.length === 0" class="flex flex-col items-center justify-center p-12 bg-base-200/50 rounded-2xl border border-base-200 border-dashed">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
        <h3 class="text-xl font-semibold text-base-content/70">No hay proyectos activos</h3>
        <p class="text-base-content/50 mt-2 text-center max-w-md">En este momento no hay proyectos de infraestructura o desarrollo en curso para mostrar.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="proyecto in store.proyectos" 
          :key="proyecto.id"
          class="card bg-base-100 shadow-xl border border-base-200 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group overflow-hidden"
        >
          <div class="h-2 w-full" :class="{
            'bg-warning': proyecto.estado === 'PLANIFICACION',
            'bg-info': proyecto.estado === 'EN_CURSO',
            'bg-success': proyecto.estado === 'FINALIZADO'
          }"></div>
          <div class="card-body">
            <div class="flex justify-between items-start gap-4">
              <h3 class="card-title text-xl group-hover:text-primary transition-colors line-clamp-2">{{ proyecto.nombre }}</h3>
              <div class="badge font-medium shadow-sm whitespace-nowrap" :class="{
                'badge-warning': proyecto.estado === 'PLANIFICACION',
                'badge-info badge-outline': proyecto.estado === 'EN_CURSO',
                'badge-success': proyecto.estado === 'FINALIZADO'
              }">{{ proyecto.estado }}</div>
            </div>
            
            <p class="text-sm text-base-content/70 line-clamp-3 my-2">{{ proyecto.descripcion }}</p>
            
            <div class="mt-auto pt-4">
              <div class="flex justify-between text-sm mb-2 font-medium">
                <span class="text-base-content/80">Ejecución Presupuestaria</span>
                <span :class="proyecto.monto_ejecutado > proyecto.presupuesto_estimado ? 'text-error' : 'text-success'">
                  {{ Math.round((proyecto.monto_ejecutado / (proyecto.presupuesto_estimado || 1)) * 100) }}%
                </span>
              </div>
              <progress 
                class="progress w-full h-3" 
                :class="proyecto.monto_ejecutado > proyecto.presupuesto_estimado ? 'progress-error' : 'progress-success bg-base-200'"
                :value="proyecto.monto_ejecutado" 
                :max="proyecto.presupuesto_estimado || 1"
              ></progress>
              <div class="flex justify-between text-xs text-base-content/60 mt-2 font-medium">
                <div class="flex flex-col">
                  <span class="opacity-70">Ejecutado</span>
                  <span class="text-base-content">{{ formatearMoneda(proyecto.monto_ejecutado) }}</span>
                </div>
                <div class="flex flex-col items-end">
                  <span class="opacity-70">Presupuesto</span>
                  <span class="text-base-content">{{ formatearMoneda(proyecto.presupuesto_estimado) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Feed Cuentas Claras -->
    <section>
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 class="text-3xl font-bold text-base-content flex items-center gap-3">
          <div class="p-2 bg-success/10 rounded-lg text-success">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          Cuentas Claras
        </h2>
        
        <div class="join shadow-sm">
          <button class="join-item btn btn-sm" :class="filtroTransacciones === 'TODOS' ? 'btn-active' : ''" @click="filtroTransacciones = 'TODOS'">Todos</button>
          <button class="join-item btn btn-sm" :class="filtroTransacciones === 'INGRESO' ? 'btn-active text-success' : ''" @click="filtroTransacciones = 'INGRESO'">Ingresos</button>
          <button class="join-item btn btn-sm" :class="filtroTransacciones === 'EGRESO' ? 'btn-active text-error' : ''" @click="filtroTransacciones = 'EGRESO'">Egresos</button>
        </div>
      </div>

      <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <div v-if="store.loading" class="flex justify-center py-12">
          <span class="loading loading-bars loading-lg text-primary"></span>
        </div>
        
        <div v-else-if="transaccionesFiltradas.length === 0" class="flex flex-col items-center justify-center py-16 px-4">
          <div class="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <h3 class="text-lg font-medium text-base-content/70">No hay transacciones</h3>
          <p class="text-base-content/50 text-sm mt-1">No se encontraron movimientos para el filtro seleccionado.</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead class="bg-base-200/50 text-base-content/70">
              <tr>
                <th class="font-semibold py-4">Fecha</th>
                <th class="font-semibold py-4">Concepto / Categoría</th>
                <th class="font-semibold py-4 text-right">Monto</th>
                <th class="font-semibold py-4 text-center">Respaldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transaccion in transaccionesFiltradas" :key="transaccion.id" class="hover:bg-base-200/30 transition-colors">
                <td class="whitespace-nowrap">
                  <span class="text-sm font-medium">{{ formatearFecha(transaccion.fecha) }}</span>
                </td>
                <td>
                  <div class="font-medium text-base-content">{{ transaccion.descripcion }}</div>
                  <div class="text-xs text-base-content/60 mt-1 flex items-center gap-2">
                    <span class="badge badge-ghost badge-sm">{{ transaccion.categoria }}</span>
                    <span v-if="transaccion.proyecto_id" class="badge badge-primary badge-outline badge-sm">Asociado a Proyecto</span>
                  </div>
                </td>
                <td class="text-right font-bold whitespace-nowrap">
                  <div :class="transaccion.tipo === 'INGRESO' ? 'text-success' : 'text-error'">
                    <span v-if="transaccion.tipo === 'INGRESO'">+</span>
                    <span v-else>-</span>
                    {{ formatearMoneda(transaccion.monto) }}
                  </div>
                </td>
                <td class="text-center">
                  <div class="tooltip tooltip-left" :data-tip="transaccion.respaldo_url ? 'Ver Evidencia' : 'Sin Respaldo Adjunto'">
                    <a 
                      v-if="transaccion.respaldo_url" 
                      :href="transaccion.respaldo_url" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="btn btn-circle btn-ghost btn-sm text-primary hover:bg-primary/10"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </a>
                    <button v-else class="btn btn-circle btn-ghost btn-sm text-base-content/20" disabled>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

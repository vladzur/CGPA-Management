<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { useFinanzasStore } from '../stores/finanzas';
import TransactionForm from '../components/TransactionForm.vue';
import TransactionList from '../components/TransactionList.vue';

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

const saldoTotal = computed(() => store.institucion?.saldo_total || 0);
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-8">
    
    <!-- Hero con el Saldo Total -->
    <div class="hero rounded-3xl bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white shadow-xl overflow-hidden">
      <div class="hero-content text-center py-12 md:py-20 w-full relative">
        <div class="max-w-md relative z-10">
          <h1 class="text-3xl font-semibold mb-2 opacity-90 drop-shadow-md">Fondo General CGPA</h1>
          <div v-if="store.loading" class="loading loading-spinner loading-lg my-4 text-white"></div>
          <p v-else class="text-5xl md:text-6xl font-bold tracking-tight drop-shadow-lg">
            {{ formatearMoneda(saldoTotal) }}
          </p>
          <p class="py-4 opacity-80 text-sm font-medium">
            Actualizado en tiempo real para máxima transparencia.
          </p>
          <button class="btn btn-neutral text-neutral-content mt-2 shadow-lg border-0 bg-white/20 hover:bg-white/30 backdrop-blur-md">
            Ver Movimientos
          </button>
        </div>
        <!-- Decoración de fondo -->
        <div class="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
      </div>
    </div>

    <!-- Layout Grid: Formulario de Registro a la Izquierda y Proyectos a la Derecha -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Columna Izquierda: Formulario -->
      <div class="lg:col-span-1">
        <TransactionForm />
      </div>

      <!-- Columna Derecha: Proyectos -->
      <div class="lg:col-span-2">

    <!-- Lista de Proyectos de Infraestructura -->
    <div>
      <h2 class="text-2xl font-bold mb-6 text-base-content flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-liceo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        Proyectos de Infraestructura
      </h2>
      
      <div v-if="store.loading" class="flex justify-center py-10">
        <span class="loading loading-bars loading-lg text-liceo-primary"></span>
      </div>
      
      <div v-else-if="store.proyectos.length === 0" class="alert alert-info shadow-md bg-blue-50 text-blue-900 border-blue-200">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>Aún no hay proyectos registrados en este periodo.</span>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="proyecto in store.proyectos" 
          :key="proyecto.id"
          class="card bg-base-100 shadow-xl border border-base-200 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 group"
        >
          <div class="card-body">
            <h2 class="card-title text-lg group-hover:text-liceo-primary transition-colors">{{ proyecto.nombre }}</h2>
            <p class="text-sm text-base-content/70 line-clamp-2">{{ proyecto.descripcion }}</p>
            
            <div class="mt-4">
              <div class="flex justify-between text-sm mb-1 font-medium">
                <span>Ejecución Financiera</span>
                <span class="text-liceo-primary font-bold">{{ Math.round((proyecto.monto_ejecutado / proyecto.presupuesto_estimado) * 100) }}%</span>
              </div>
              <progress 
                class="progress w-full bg-base-200 [&::-webkit-progress-value]:bg-liceo-primary [&::-moz-progress-bar]:bg-liceo-primary" 
                :value="proyecto.monto_ejecutado" 
                :max="proyecto.presupuesto_estimado"
              ></progress>
              <div class="flex justify-between text-xs text-base-content/60 mt-1 font-medium">
                <span>{{ formatearMoneda(proyecto.monto_ejecutado) }}</span>
                <span>{{ formatearMoneda(proyecto.presupuesto_estimado) }}</span>
              </div>
            </div>
            
            <div class="card-actions justify-end mt-4 border-t border-base-200 pt-4">
              <div class="badge font-medium shadow-sm" :class="{
                'badge-warning': proyecto.estado === 'PLANIFICACION',
                'badge-info': proyecto.estado === 'EN_CURSO',
                'badge-success': proyecto.estado === 'FINALIZADO'
              }">{{ proyecto.estado }}</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    </div>
    
    <!-- Lista de Movimientos Globales -->
    <TransactionList />
  </div>
</template>

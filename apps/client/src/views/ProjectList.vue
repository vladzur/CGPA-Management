<script setup lang="ts">
import { ref } from 'vue';
import { useFinanzasStore } from '../stores/finanzas';
import { useRouter } from 'vue-router';
import apiClient from '../plugins/axios';

const store = useFinanzasStore();
const router = useRouter();

const showModal = ref(false);
const isSubmitting = ref(false);
const errorMsg = ref('');

const newProject = ref({
  nombre: '',
  descripcion: '',
  presupuesto_estimado: 0,
});

const submitProject = async () => {
  errorMsg.value = '';
  isSubmitting.value = true;
  
  try {
    await apiClient.post('/proyectos', {
      nombre: newProject.value.nombre,
      descripcion: newProject.value.descripcion,
      presupuesto_estimado: newProject.value.presupuesto_estimado,
      responsable: {
        uid: 'user-123', // Mock user for now
        nombre: 'Directiva',
      }
    });
    
    showModal.value = false;
    newProject.value = { nombre: '', descripcion: '', presupuesto_estimado: 0 };
    
  } catch (error: any) {
    errorMsg.value = error.response?.data?.message || 'Error al crear el proyecto';
    if (Array.isArray(error.response?.data?.errors)) {
       errorMsg.value = error.response.data.errors.join(' | ');
    }
  } finally {
    isSubmitting.value = false;
  }
};

const goToDetail = (id: string) => {
  router.push(`/proyectos/${id}`);
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(value || 0);
};

const getProgress = (proy: any) => {
  if (!proy.presupuesto_estimado) return 0;
  return Math.min((proy.monto_ejecutado / proy.presupuesto_estimado) * 100, 100);
};

const isOverBudget = (proy: any) => {
  return proy.monto_ejecutado > proy.presupuesto_estimado;
};
</script>

<template>
  <div class="container mx-auto p-4 max-w-7xl">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-liceo-primary">Gestión de Proyectos</h1>
      <button @click="showModal = true" class="btn btn-primary bg-liceo-primary border-none text-white shadow-lg">
        + Nuevo Proyecto
      </button>
    </div>

    <!-- Lista de Proyectos -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="proy in store.proyectos" 
        :key="proy.id" 
        class="card bg-base-100 shadow-xl border border-base-200 hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden"
        @click="goToDetail(proy.id)"
      >
        <div v-if="isOverBudget(proy)" class="absolute top-0 right-0 bg-error text-white text-xs font-bold px-3 py-1 rounded-bl-lg shadow">
          ¡Sobre Presupuesto!
        </div>

        <div class="card-body">
          <h2 class="card-title text-xl text-neutral mb-2">{{ proy.nombre }}</h2>
          <p class="text-gray-600 text-sm line-clamp-2 mb-4">{{ proy.descripcion }}</p>
          
          <div class="flex justify-between text-sm mb-1">
            <span class="font-medium text-gray-500">Ejecutado</span>
            <span class="font-bold text-neutral">{{ formatCurrency(proy.monto_ejecutado) }}</span>
          </div>
          <div class="flex justify-between text-sm mb-3">
            <span class="font-medium text-gray-500">Presupuesto</span>
            <span class="font-bold text-primary">{{ formatCurrency(proy.presupuesto_estimado) }}</span>
          </div>

          <div class="w-full bg-gray-200 rounded-full h-3 mb-1 overflow-hidden shadow-inner">
            <div 
              class="h-3 rounded-full transition-all duration-500"
              :class="{
                'bg-success': getProgress(proy) < 75,
                'bg-warning': getProgress(proy) >= 75 && getProgress(proy) <= 100 && !isOverBudget(proy),
                'bg-error': isOverBudget(proy) || getProgress(proy) > 100
              }"
              :style="{ width: `${getProgress(proy)}%` }"
            ></div>
          </div>
          <div class="flex justify-end">
             <span class="text-xs font-bold text-gray-500" :class="{'text-error': isOverBudget(proy)}">
               {{ getProgress(proy).toFixed(1) }}% consumido
             </span>
          </div>
        </div>
      </div>
      
      <div v-if="store.proyectos.length === 0 && !store.loading" class="col-span-full text-center py-10 text-gray-500">
        No hay proyectos registrados. Crea uno nuevo para comenzar.
      </div>
    </div>

    <!-- Modal Nuevo Proyecto -->
    <dialog class="modal" :class="{'modal-open': showModal}">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4 text-liceo-primary">Crear Nuevo Proyecto</h3>
        
        <div v-if="errorMsg" class="alert alert-error mb-4 shadow-sm text-white">
          <span>{{ errorMsg }}</span>
        </div>

        <form @submit.prevent="submitProject">
          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Nombre del Proyecto</span></label>
            <input v-model="newProject.nombre" type="text" class="input input-bordered" required />
          </div>
          
          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Descripción</span></label>
            <textarea v-model="newProject.descripcion" class="textarea textarea-bordered h-24" required></textarea>
          </div>
          
          <div class="form-control mb-6">
            <label class="label"><span class="label-text">Presupuesto Inicial (CLP)</span></label>
            <input v-model.number="newProject.presupuesto_estimado" type="number" class="input input-bordered" required min="0" />
          </div>

          <div class="modal-action">
            <button type="button" class="btn" @click="showModal = false" :disabled="isSubmitting">Cancelar</button>
            <button type="submit" class="btn btn-primary bg-liceo-primary border-none text-white" :disabled="isSubmitting">
              <span v-if="isSubmitting" class="loading loading-spinner"></span>
              Crear Proyecto
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showModal = false">close</button>
      </form>
    </dialog>
  </div>
</template>

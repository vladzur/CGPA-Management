<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFinanzasStore } from '../stores/finanzas';
import apiClient from '../plugins/axios';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Transaccion } from '@cgpa/shared';

const route = useRoute();
const router = useRouter();
const store = useFinanzasStore();

const projectId = route.params.id as string;
const isEditing = ref(false);
const isSubmitting = ref(false);
const isDeleting = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const projectTransactions = ref<(Transaccion & { id: string })[]>([]);
let unsubscribeTrans: () => void;

const editForm = ref({
  nombre: '',
  descripcion: '',
  presupuesto_estimado: 0,
});

const project = computed(() => store.proyectos.find((p: any) => p.id === projectId));

onMounted(() => {
  if (project.value) {
    initForm();
  }
  
  // Real-time listener para transacciones específicas del proyecto
  const transRef = collection(db, 'transacciones');
  const qTrans = query(
    transRef, 
    where('proyecto_id', '==', projectId),
    orderBy('fecha', 'desc')
  );
  
  unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
    const data: (Transaccion & { id: string })[] = [];
    snapshot.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() } as any);
    });
    projectTransactions.value = data;
  });
});

onUnmounted(() => {
  if (unsubscribeTrans) unsubscribeTrans();
});

const initForm = () => {
  if (project.value) {
    editForm.value.nombre = project.value.nombre;
    editForm.value.descripcion = project.value.descripcion;
    editForm.value.presupuesto_estimado = project.value.presupuesto_estimado;
  }
};

const toggleEdit = () => {
  if (!isEditing.value) {
    initForm();
  }
  isEditing.value = !isEditing.value;
};

const updateProject = async () => {
  errorMsg.value = '';
  successMsg.value = '';
  isSubmitting.value = true;
  
  try {
    await apiClient.patch(`/proyectos/${projectId}`, editForm.value);
    successMsg.value = 'Proyecto actualizado exitosamente.';
    isEditing.value = false;
    setTimeout(() => successMsg.value = '', 3000);
  } catch (error: any) {
    errorMsg.value = error.response?.data?.message || 'Error al actualizar';
  } finally {
    isSubmitting.value = false;
  }
};

const deleteProject = async () => {
  if (!confirm('¿Estás seguro de eliminar este proyecto?')) return;
  if (projectTransactions.value.length > 0) {
    alert('No se puede eliminar porque tiene transacciones asociadas.');
    return;
  }

  isDeleting.value = true;
  try {
    await apiClient.delete(`/proyectos/${projectId}`);
    router.push('/proyectos');
  } catch (error: any) {
    alert(error.response?.data?.message || 'Error al eliminar');
  } finally {
    isDeleting.value = false;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value || 0);
};

const formatDate = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('es-CL', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const getProgress = () => {
  if (!project.value || !project.value.presupuesto_estimado) return 0;
  return Math.min((project.value.monto_ejecutado / project.value.presupuesto_estimado) * 100, 100);
};

const isOverBudget = () => {
  if (!project.value) return false;
  return project.value.monto_ejecutado > project.value.presupuesto_estimado;
};
</script>

<template>
  <div class="container mx-auto p-4 max-w-5xl" v-if="project">
    <div class="mb-4">
      <button @click="router.push('/proyectos')" class="btn btn-ghost btn-sm text-gray-500 hover:text-neutral">
        &larr; Volver a Proyectos
      </button>
    </div>

    <!-- Mensajes -->
    <div v-if="successMsg" class="alert alert-success shadow-sm mb-4 text-white">
      <span>{{ successMsg }}</span>
    </div>
    <div v-if="errorMsg" class="alert alert-error shadow-sm mb-4 text-white">
      <span>{{ errorMsg }}</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Panel de Detalles y Edición -->
      <div class="lg:col-span-1 space-y-6">
        <div class="card bg-base-100 shadow-xl border border-base-200">
          <div class="card-body">
            <div class="flex justify-between items-start mb-4">
              <h2 class="card-title text-2xl text-liceo-primary">Detalles</h2>
              <button @click="toggleEdit" class="btn btn-circle btn-ghost btn-sm">
                <svg v-if="!isEditing" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Vista Lectura -->
            <div v-if="!isEditing" class="space-y-4">
              <div>
                <span class="text-xs font-bold text-gray-500 uppercase">Nombre</span>
                <p class="font-medium text-lg text-neutral">{{ project.nombre }}</p>
              </div>
              <div>
                <span class="text-xs font-bold text-gray-500 uppercase">Descripción</span>
                <p class="text-sm text-gray-600">{{ project.descripcion }}</p>
              </div>
              
              <div class="divider my-2"></div>
              
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-base-200 p-3 rounded-lg text-center">
                  <span class="block text-xs font-bold text-gray-500 uppercase mb-1">Presupuesto</span>
                  <span class="block text-lg font-bold text-primary">{{ formatCurrency(project.presupuesto_estimado) }}</span>
                </div>
                <div class="bg-base-200 p-3 rounded-lg text-center">
                  <span class="block text-xs font-bold text-gray-500 uppercase mb-1">Ejecutado</span>
                  <span class="block text-lg font-bold" :class="isOverBudget() ? 'text-error' : 'text-neutral'">
                    {{ formatCurrency(project.monto_ejecutado) }}
                  </span>
                </div>
              </div>

              <!-- Barra de Progreso -->
              <div class="mt-4">
                <div class="flex justify-between text-xs font-bold mb-1">
                  <span class="text-gray-500">Progreso Financiero</span>
                  <span :class="isOverBudget() ? 'text-error' : 'text-neutral'">{{ getProgress().toFixed(1) }}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-4 shadow-inner overflow-hidden">
                  <div class="h-4 rounded-full transition-all duration-700"
                    :class="{
                      'bg-success': getProgress() < 75,
                      'bg-warning': getProgress() >= 75 && getProgress() <= 100 && !isOverBudget(),
                      'bg-error': isOverBudget() || getProgress() > 100
                    }"
                    :style="{ width: `${getProgress()}%` }">
                  </div>
                </div>
                <p v-if="isOverBudget()" class="text-xs text-error font-bold mt-2 text-center">
                  El proyecto ha superado su presupuesto inicial.
                </p>
              </div>

              <div class="mt-6 pt-4 border-t border-base-200">
                <button 
                  @click="deleteProject" 
                  class="btn btn-outline btn-error btn-sm w-full"
                  :disabled="projectTransactions.length > 0 || isDeleting"
                >
                  <span v-if="isDeleting" class="loading loading-spinner"></span>
                  Eliminar Proyecto
                </button>
                <p v-if="projectTransactions.length > 0" class="text-xs text-gray-400 mt-2 text-center">
                  No se puede eliminar porque tiene transacciones asociadas.
                </p>
              </div>
            </div>

            <!-- Vista Edición -->
            <form v-else @submit.prevent="updateProject" class="space-y-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Nombre</span></label>
                <input v-model="editForm.nombre" type="text" class="input input-bordered w-full" required />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Descripción</span></label>
                <textarea v-model="editForm.descripcion" class="textarea textarea-bordered h-24 w-full" required></textarea>
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Presupuesto (CLP)</span></label>
                <input v-model.number="editForm.presupuesto_estimado" type="number" class="input input-bordered w-full" required min="0" />
              </div>
              
              <div class="flex gap-2 mt-6">
                <button type="submit" class="btn btn-primary flex-1 bg-liceo-primary border-none text-white" :disabled="isSubmitting">
                  <span v-if="isSubmitting" class="loading loading-spinner"></span>
                  Guardar
                </button>
                <button type="button" @click="toggleEdit" class="btn flex-1" :disabled="isSubmitting">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Panel de Historial de Transacciones -->
      <div class="lg:col-span-2">
        <div class="card bg-base-100 shadow-xl border border-base-200 h-full">
          <div class="card-body">
            <h2 class="card-title text-xl text-neutral mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              Historial de Gastos
            </h2>

            <div v-if="projectTransactions.length === 0" class="text-center py-12 text-gray-500">
              No hay gastos registrados para este proyecto.
            </div>

            <div v-else class="overflow-x-auto">
              <table class="table w-full">
                <thead>
                  <tr class="bg-base-200 text-neutral">
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th class="text-right">Monto</th>
                    <th>Respaldo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in projectTransactions" :key="t.id" class="hover">
                    <td class="text-sm">{{ formatDate(t.fecha) }}</td>
                    <td>
                      <span class="badge badge-ghost badge-sm font-medium">{{ t.categoria }}</span>
                    </td>
                    <td class="text-sm max-w-xs truncate" :title="t.descripcion">{{ t.descripcion }}</td>
                    <td class="text-right font-bold text-error">
                      -{{ formatCurrency(t.monto) }}
                    </td>
                    <td>
                      <a v-if="t.respaldo_url" :href="t.respaldo_url" target="_blank" class="btn btn-xs btn-ghost text-primary hover:bg-primary/10">
                        Ver
                      </a>
                      <span v-else class="text-xs text-gray-400">N/A</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Loading state -->
  <div v-else-if="store.loading" class="flex justify-center items-center h-64">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
  
  <!-- Not found state -->
  <div v-else class="text-center py-20">
    <h2 class="text-2xl font-bold text-gray-600 mb-4">Proyecto no encontrado</h2>
    <button @click="router.push('/proyectos')" class="btn btn-primary">Volver a la lista</button>
  </div>
</template>

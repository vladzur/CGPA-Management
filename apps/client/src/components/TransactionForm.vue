<script setup lang="ts">
import { ref } from 'vue';
import { useFinanzasStore } from '../stores/finanzas';
import apiClient from '../plugins/axios';

const store = useFinanzasStore();
const isSubmitting = ref(false);
const showSuccess = ref(false);
const errorMsg = ref('');

const form = ref({
  tipo: 'EGRESO',
  monto: '',
  categoria: '',
  descripcion: '',
  proyecto_id: ''
});

const fileInput = ref<HTMLInputElement | null>(null);

const submitForm = async () => {
  errorMsg.value = '';
  showSuccess.value = false;
  
  if (!form.value.monto || Number(form.value.monto) <= 0) {
    errorMsg.value = 'El monto debe ser mayor a 0';
    return;
  }
  
  isSubmitting.value = true;
  
  try {
    const formData = new FormData();
    formData.append('tipo', form.value.tipo);
    formData.append('monto', form.value.monto);
    formData.append('categoria', form.value.categoria);
    formData.append('descripcion', form.value.descripcion);
    formData.append('fecha', new Date().toISOString());
    
    if (form.value.proyecto_id) {
      formData.append('proyecto_id', form.value.proyecto_id);
    }
    
    // Adjuntar archivo capturado con la cámara
    if (fileInput.value && fileInput.value.files && fileInput.value.files.length > 0) {
      formData.append('file', fileInput.value.files[0]);
    }

    // POST multipart/form-data
    await apiClient.post('/transactions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    showSuccess.value = true;
    
    // Resetear formulario
    form.value.monto = '';
    form.value.descripcion = '';
    form.value.proyecto_id = '';
    if (fileInput.value) fileInput.value.value = '';
    
    // Ocultar mensaje de éxito después de 4s
    setTimeout(() => showSuccess.value = false, 4000);
    
  } catch (error: any) {
    errorMsg.value = error.response?.data?.message || 'Error al procesar la transacción';
    if (Array.isArray(error.response?.data?.errors)) {
       errorMsg.value = error.response.data.errors.join(' | ');
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="card-body">
      <h2 class="card-title text-xl mb-4 text-liceo-primary flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Registrar Movimiento
      </h2>
      
      <div v-if="showSuccess" class="alert alert-success shadow-sm mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span class="text-white font-medium">¡Transacción guardada exitosamente!</span>
      </div>
      
      <div v-if="errorMsg" class="alert alert-error shadow-sm mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span class="text-white font-medium">{{ errorMsg }}</span>
      </div>

      <form @submit.prevent="submitForm" class="space-y-4">
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control w-full">
            <label class="label"><span class="label-text font-medium text-neutral">Tipo de Movimiento</span></label>
            <select v-model="form.tipo" class="select select-bordered w-full" :disabled="isSubmitting">
              <option value="INGRESO">Ingreso (Aporte/Rifa)</option>
              <option value="EGRESO">Egreso (Gasto/Pago)</option>
            </select>
          </div>

          <div class="form-control w-full">
            <label class="label"><span class="label-text font-medium text-neutral">Categoría</span></label>
            <select v-model="form.categoria" class="select select-bordered w-full" :disabled="isSubmitting" required>
              <option value="" disabled>Seleccione categoría...</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Eventos">Eventos</option>
              <option value="Equipamiento">Equipamiento</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
        </div>

        <div class="form-control w-full">
          <label class="label"><span class="label-text font-medium text-neutral">Monto (CLP)</span></label>
          <div class="input-group flex">
            <span class="bg-base-200 px-4 flex items-center border border-r-0 border-base-300 rounded-l-lg font-bold">$</span>
            <input type="number" v-model="form.monto" placeholder="Ej: 15000" class="input input-bordered w-full rounded-l-none" required min="1" :disabled="isSubmitting" />
          </div>
        </div>
        
        <!-- Opciones exclusivas de Egresos -->
        <div class="form-control w-full" v-if="form.tipo === 'EGRESO'">
          <label class="label"><span class="label-text font-medium text-neutral">Asociar a Proyecto (Opcional)</span></label>
          <select v-model="form.proyecto_id" class="select select-bordered w-full" :disabled="isSubmitting">
            <option value="">Ninguno (Gasto general)</option>
            <option v-for="proy in store.proyectos" :key="proy.id" :value="proy.id">
              {{ proy.nombre }}
            </option>
          </select>
        </div>

        <div class="form-control w-full">
          <label class="label"><span class="label-text font-medium text-neutral">Descripción</span></label>
          <input type="text" v-model="form.descripcion" placeholder="Ej: Compra de pintura para sala" class="input input-bordered w-full" required :disabled="isSubmitting" />
        </div>

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-medium text-neutral flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              Comprobante
            </span>
          </label>
          <!-- Atributo capture="environment" abre la cámara trasera en móviles -->
          <input type="file" ref="fileInput" accept="image/*,application/pdf" capture="environment" class="file-input file-input-bordered file-input-primary w-full" :disabled="isSubmitting" />
          <span class="label-text-alt text-gray-500 mt-1">Usa la cámara de tu teléfono para subir la boleta.</span>
        </div>

        <div class="form-control mt-6">
          <button type="submit" class="btn btn-primary bg-liceo-primary border-none text-white w-full shadow-lg hover:shadow-xl transition-shadow" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="loading loading-spinner"></span>
            {{ isSubmitting ? 'Procesando...' : 'Registrar Transacción' }}
          </button>
        </div>
        
      </form>
    </div>
  </div>
</template>

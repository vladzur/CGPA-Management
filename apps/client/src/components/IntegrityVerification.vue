<script setup lang="ts">
import { ref } from 'vue';
import apiClient from '../plugins/axios';

interface IntegrityBreak {
  documento_id: string;
  numero_secuencia: number;
  razon: string;
}

interface IntegrityReport {
  valida: boolean;
  total_verificadas: number;
  rupturas: IntegrityBreak[];
  mensaje: string;
}

const isVerifying = ref(false);
const result = ref<IntegrityReport | null>(null);
const errorMessage = ref('');
const showModal = ref(false);

const verifyIntegrity = async () => {
  isVerifying.value = true;
  errorMessage.value = '';
  result.value = null;

  try {
    const res = await apiClient.get('/transactions/verify-integrity');
    result.value = res.data.data;
  } catch (err: any) {
    errorMessage.value =
      err.response?.data?.message || 'No se pudo conectar con el servidor de verificación.';
  } finally {
    isVerifying.value = false;
    showModal.value = true;
  }
};
</script>

<template>
  <!-- Botón disparador -->
  <button
    class="btn btn-outline btn-sm gap-2"
    :disabled="isVerifying"
    @click="verifyIntegrity"
  >
    <span v-if="isVerifying" class="loading loading-spinner loading-xs"></span>
    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
    Verificar Integridad
  </button>

  <!-- Modal -->
  <dialog class="modal" :class="{ 'modal-open': showModal }">
    <div class="modal-box max-w-2xl">

      <!-- Loading -->
      <div v-if="isVerifying" class="flex justify-center py-8">
        <span class="loading loading-bars loading-lg text-primary"></span>
      </div>

      <!-- Error -->
      <div v-else-if="errorMessage" class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Cadena Íntegra -->
      <div v-else-if="result?.valida">
        <h3 class="font-bold text-lg text-success flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Cadena Íntegra
        </h3>
        <p class="py-4">{{ result.mensaje }}</p>
        <div class="stats shadow bg-success/10 w-full">
          <div class="stat">
            <div class="stat-title">Transacciones Verificadas</div>
            <div class="stat-value text-success">{{ result.total_verificadas }}</div>
          </div>
        </div>
      </div>

      <!-- Cadena Comprometida -->
      <div v-else-if="result && !result.valida">
        <h3 class="font-bold text-lg text-error flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Cadena Comprometida
        </h3>
        <p class="py-4 text-error">{{ result.mensaje }}</p>

        <div class="overflow-x-auto mt-4">
          <table class="table table-sm table-zebra">
            <thead>
              <tr class="bg-error/10">
                <th># Secuencia</th>
                <th>Documento ID</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in result.rupturas" :key="r.documento_id">
                <td class="font-mono font-bold">{{ r.numero_secuencia }}</td>
                <td class="font-mono text-xs">{{ r.documento_id.substring(0, 12) }}...</td>
                <td class="text-sm">{{ r.razon }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-sm text-base-content/60 mt-4">
          Se recomienda contactar a la directiva del CGPA.
        </p>
      </div>

      <div class="modal-action">
        <button class="btn btn-sm" @click="showModal = false">Cerrar</button>
      </div>
    </div>

    <!-- Backdrop click to close -->
    <form method="dialog" class="modal-backdrop">
      <button @click="showModal = false">close</button>
    </form>
  </dialog>
</template>

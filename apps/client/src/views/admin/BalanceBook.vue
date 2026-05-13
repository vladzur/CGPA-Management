<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '../../plugins/axios';

interface Proyecto {
  id: string;
  nombre: string;
  estado: string;
}

const periodos = Array.from({ length: 11 }, (_, i) => String(2020 + i));

const periodo = ref<string>(String(new Date().getFullYear()));
const usarRangoPersonalizado = ref(false);
const fechaInicio = ref('');
const fechaFin = ref('');
const proyectoId = ref('');
const titulo = ref('');
const rutEmisor = ref('');
const proyectos = ref<Proyecto[]>([]);

const loading = ref(false);
const loadingProyectos = ref(false);
const errorMsg = ref('');

const fetchProyectos = async () => {
  loadingProyectos.value = true;
  try {
    const res = await apiClient.get('/proyectos');
    proyectos.value = res.data;
  } catch {
    // Filtro de proyecto es opcional, si falla seguimos sin él
    proyectos.value = [];
  } finally {
    loadingProyectos.value = false;
  }
};

const buildPayload = (modo: 'borrador' | 'firmado') => {
  const payload: Record<string, unknown> = {
    periodo: periodo.value,
    modo,
  };

  if (usarRangoPersonalizado.value) {
    if (fechaInicio.value) payload.fecha_inicio = new Date(fechaInicio.value).toISOString();
    if (fechaFin.value) payload.fecha_fin = new Date(fechaFin.value).toISOString();
  }

  if (proyectoId.value) payload.proyecto_id = proyectoId.value;
  if (titulo.value.trim()) payload.titulo = titulo.value.trim();
  if (rutEmisor.value.trim()) payload.rut_emisor = rutEmisor.value.trim();

  return payload;
};

const generateBook = async (modo: 'borrador' | 'firmado') => {
  loading.value = true;
  errorMsg.value = '';

  try {
    const payload = buildPayload(modo);
    const response = await apiClient.post('/libro-balance/generar', payload, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const sufijo = modo === 'borrador' ? 'borrador' : 'firmado';
    link.setAttribute('download', `libro-balance-${periodo.value}-${sufijo}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || 'Error al generar el libro de balance';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchProyectos();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-6">
    <h1 class="text-3xl font-bold text-liceo-primary">Libro de Balance</h1>

    <div class="card bg-base-100 shadow-md border border-base-200">
      <div class="card-body space-y-4">
        <!-- Período -->
        <div class="form-control">
          <label class="label"><span class="label-text font-medium">Período</span></label>
          <select v-model="periodo" class="select select-bordered max-w-xs">
            <option v-for="y in periodos" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <!-- Rango personalizado toggle -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-4">
            <input
              v-model="usarRangoPersonalizado"
              type="checkbox"
              class="checkbox checkbox-primary"
            />
            <span class="label-text">Usar rango de fechas personalizado</span>
          </label>
        </div>

        <div v-if="usarRangoPersonalizado" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Fecha inicio</span></label>
            <input v-model="fechaInicio" type="datetime-local" class="input input-bordered" />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Fecha fin</span></label>
            <input v-model="fechaFin" type="datetime-local" class="input input-bordered" />
          </div>
        </div>

        <!-- Proyecto (opcional) -->
        <div class="form-control">
          <label class="label"><span class="label-text">Proyecto (opcional)</span></label>
          <select v-model="proyectoId" class="select select-bordered max-w-xs" :disabled="loadingProyectos">
            <option value="">Todos los proyectos</option>
            <option v-for="p in proyectos" :key="p.id" :value="p.id">
              {{ p.nombre }} ({{ p.estado }})
            </option>
          </select>
        </div>

        <!-- Título personalizado -->
        <div class="form-control">
          <label class="label"><span class="label-text">Título (opcional)</span></label>
          <input
            v-model="titulo"
            type="text"
            class="input input-bordered max-w-md"
            :placeholder="`Libro de Balance - Período ${periodo}`"
          />
        </div>

        <!-- RUT emisor -->
        <div class="form-control">
          <label class="label"><span class="label-text">RUT Emisor (opcional)</span></label>
          <input
            v-model="rutEmisor"
            type="text"
            class="input input-bordered max-w-xs"
            placeholder="XX.XXX.XXX-X"
          />
        </div>

        <!-- Error -->
        <div v-if="errorMsg" class="alert alert-error text-white">
          <span>{{ errorMsg }}</span>
        </div>

        <!-- Botones de acción -->
        <div class="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            class="btn btn-outline btn-primary"
            :disabled="loading"
            @click="generateBook('borrador')"
          >
            <span v-if="loading" class="loading loading-spinner"></span>
            Descargar Borrador
          </button>
          <button
            class="btn btn-primary bg-liceo-primary border-none text-white"
            :disabled="loading"
            @click="generateBook('firmado')"
          >
            <span v-if="loading" class="loading loading-spinner"></span>
            Generar Libro Firmado
          </button>
        </div>

        <p class="text-xs text-gray-500 pt-1">
          <strong>Borrador:</strong> PDF sin firma digital MVI. |
          <strong>Firmado:</strong> PDF con hash SHA-256 y código QR de verificación.
        </p>
      </div>
    </div>
  </div>
</template>

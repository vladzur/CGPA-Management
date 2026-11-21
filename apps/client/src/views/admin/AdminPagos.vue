<script setup lang="ts">
/**
 * Historial de cobros del botón de pago para la directiva.
 *
 * Es una vista de solo lectura: muestra lo que la pasarela ya confirmó y lo que
 * sigue pendiente. La conciliación contable se sigue haciendo con el formulario
 * de transacciones existente.
 */
import { computed, onMounted, ref } from 'vue';
import {
  ESTADO_PAGO_LABELS,
  TIPO_APORTE_LABELS,
  type EstadoPago,
  type Pago,
  type TipoAporte,
} from '@cgpa/shared';
import apiClient from '../../plugins/axios';
import { formatCurrency, formatDateTime } from '../../utils/format';

type PagoConId = Pago & { id: string };

const ESTADOS: EstadoPago[] = [
  'PENDIENTE',
  'PAGADO',
  'CANCELADO',
  'FALLIDO',
];

const TIPOS = Object.entries(TIPO_APORTE_LABELS) as [TipoAporte, string][];

const pagos = ref<PagoConId[]>([]);
const loading = ref(true);
const error = ref('');
const tipoFiltro = ref<TipoAporte | ''>('');
const estadoFiltro = ref<EstadoPago | ''>('');

const fetchPagos = async (): Promise<void> => {
  loading.value = true;
  error.value = '';

  try {
    const { data } = await apiClient.get<PagoConId[]>('/pagos');
    pagos.value = data;
  } catch (err: any) {
    error.value =
      err.response?.data?.message || 'No se pudieron cargar los pagos.';
  } finally {
    loading.value = false;
  }
};

const filtrados = computed(() =>
  pagos.value.filter((pago) => {
    const coincideTipo =
      !tipoFiltro.value || pago.tipo_aporte === tipoFiltro.value;
    const coincideEstado =
      !estadoFiltro.value || pago.estado === estadoFiltro.value;

    return coincideTipo && coincideEstado;
  }),
);

const totalConfirmado = computed(() =>
  pagos.value
    .filter((pago) => pago.estado === 'PAGADO')
    .reduce((total, pago) => total + pago.monto, 0),
);

const pendientes = computed(
  () => pagos.value.filter((pago) => pago.estado === 'PENDIENTE').length,
);

const tipoLabel = (pago: PagoConId): string =>
  pago.tipo_aporte ? TIPO_APORTE_LABELS[pago.tipo_aporte] : 'Aporte';

const estadoBadge = (estado: EstadoPago): string => {
  switch (estado) {
    case 'PAGADO':
      return 'badge-success';
    case 'PENDIENTE':
      return 'badge-warning';
    default:
      return 'badge-error';
  }
};

onMounted(fetchPagos);
</script>

<template>
  <div class="container mx-auto p-4 md:p-8">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold text-base-content">Pagos recibidos</h1>
        <p class="text-base-content/70 mt-2">
          Cobros creados desde el botón de pago de Khipu. Se muestran los últimos
          200 registros.
        </p>
      </div>

      <button
        type="button"
        class="btn btn-outline btn-sm"
        :disabled="loading"
        @click="fetchPagos"
      >
        <span v-if="loading" class="loading loading-spinner loading-xs"></span>
        Actualizar
      </button>
    </div>

    <div class="grid gap-4 sm:grid-cols-3 mb-8">
      <div class="stat bg-base-100 rounded-box border border-base-200">
        <div class="stat-title">Total confirmado</div>
        <div class="stat-value text-2xl text-success">
          {{ formatCurrency(totalConfirmado) }}
        </div>
        <div class="stat-desc">Solo pagos en estado PAGADO</div>
      </div>
      <div class="stat bg-base-100 rounded-box border border-base-200">
        <div class="stat-title">Cobros listados</div>
        <div class="stat-value text-2xl">{{ pagos.length }}</div>
        <div class="stat-desc">{{ filtrados.length }} visibles con los filtros</div>
      </div>
      <div class="stat bg-base-100 rounded-box border border-base-200">
        <div class="stat-title">Pendientes</div>
        <div class="stat-value text-2xl text-warning">{{ pendientes }}</div>
        <div class="stat-desc">Aún sin confirmación bancaria</div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <label class="form-control">
        <span class="label-text mb-1">Tipo de aporte</span>
        <select v-model="tipoFiltro" class="select select-bordered select-sm">
          <option value="">Todos</option>
          <option v-for="[valor, etiqueta] in TIPOS" :key="valor" :value="valor">
            {{ etiqueta }}
          </option>
        </select>
      </label>

      <label class="form-control">
        <span class="label-text mb-1">Estado</span>
        <select v-model="estadoFiltro" class="select select-bordered select-sm">
          <option value="">Todos</option>
          <option v-for="estado in ESTADOS" :key="estado" :value="estado">
            {{ ESTADO_PAGO_LABELS[estado] }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="error" class="alert alert-error mb-6">
      <span>{{ error }}</span>
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-bars loading-lg text-primary"></span>
    </div>

    <div
      v-else-if="filtrados.length === 0"
      class="card bg-base-100 border border-dashed border-base-300"
    >
      <div class="card-body items-center text-center py-14">
        <h2 class="card-title">No hay pagos para mostrar</h2>
        <p class="text-base-content/70 max-w-lg">
          Cuando un apoderado pague la cuota anual o alguien realice una
          donación, el cobro aparecerá aquí con su estado y sus datos de
          conciliación.
        </p>
      </div>
    </div>

    <div v-else class="overflow-x-auto rounded-box border border-base-200">
      <table class="table table-zebra bg-base-100">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo / motivo</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Pagador</th>
            <th>Estudiante / curso</th>
            <th>Banco</th>
            <th>Referencia</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pago in filtrados" :key="pago.id">
            <td class="whitespace-nowrap text-sm">
              {{ formatDateTime(pago.creado_en) }}
            </td>
            <td class="min-w-48">
              <div class="font-medium">{{ tipoLabel(pago) }}</div>
              <div class="text-xs text-base-content/60">{{ pago.asunto }}</div>
            </td>
            <td class="whitespace-nowrap font-semibold">
              {{ formatCurrency(pago.monto) }}
            </td>
            <td>
              <span class="badge badge-sm" :class="estadoBadge(pago.estado)">
                {{ ESTADO_PAGO_LABELS[pago.estado] }}
              </span>
              <div
                v-if="pago.estado_detalle"
                class="text-xs text-base-content/60 mt-1"
              >
                {{ pago.estado_detalle }}
              </div>
            </td>
            <td class="min-w-48">
              <div class="font-medium">{{ pago.pagador_nombre }}</div>
              <div class="text-xs text-base-content/60">
                {{ pago.pagador_email }}
              </div>
            </td>
            <td class="text-sm">{{ pago.estudiante || '—' }}</td>
            <td class="text-sm">{{ pago.banco || '—' }}</td>
            <td class="font-mono text-xs">{{ pago.transaction_id }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-sm text-base-content/60 mt-6">
      Un pago confirmado no crea automáticamente una transacción de ingreso: la
      directiva decide cuándo conciliarlo en la contabilidad del CGPA.
    </p>
  </div>
</template>

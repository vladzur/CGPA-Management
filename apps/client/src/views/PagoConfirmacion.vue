<script setup lang="ts">
/**
 * Página de retorno tras pagar en la pasarela.
 *
 * Consulta periódicamente el estado del cobro al backend (que a su vez verifica
 * con la pasarela) hasta que el pago queda confirmado, cancelado o fallido.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ESTADO_PAGO_LABELS, type EstadoPago } from '@cgpa/shared';
import apiClient from '../plugins/axios';
import { formatCurrency, formatDateTime } from '../utils/format';

/** Intervalo entre consultas de estado. */
const POLL_INTERVAL_MS = 3000;
/** Máximo de consultas antes de dejar de insistir automáticamente. */
const MAX_POLL_ATTEMPTS = 20;

const ESTADOS_TERMINALES: EstadoPago[] = ['PAGADO', 'CANCELADO', 'FALLIDO'];

interface PagoPublico {
  transaction_id: string;
  asunto: string;
  moneda: string;
  monto: number;
  estado: EstadoPago;
  estado_detalle?: string | null;
  banco?: string | null;
  pagado_en?: unknown;
  creado_en?: unknown;
  actualizado_en?: unknown;
}

const route = useRoute();

const transactionId = computed(() => {
  const raw = route.query.transaction_id;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
});

const pago = ref<PagoPublico | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const intentos = ref(0);

let timer: number | undefined;

const detener = (): void => {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
};

const esTerminal = (estado: EstadoPago): boolean =>
  ESTADOS_TERMINALES.includes(estado);

const programar = (): void => {
  detener();
  timer = window.setTimeout(consultar, POLL_INTERVAL_MS);
};

async function consultar(): Promise<void> {
  const id = transactionId.value;

  if (!id) {
    loading.value = false;
    errorMessage.value =
      'No encontramos el identificador del pago. Si ya transferiste, contacta a la directiva con tu comprobante.';
    return;
  }

  try {
    const { data } = await apiClient.get<PagoPublico>(
      `/pagos/${encodeURIComponent(id)}`,
    );

    pago.value = data;
    errorMessage.value = '';

    if (esTerminal(data.estado)) {
      detener();
      return;
    }

    intentos.value += 1;

    if (intentos.value >= MAX_POLL_ATTEMPTS) {
      detener();
      return;
    }

    programar();
  } catch {
    intentos.value += 1;
    errorMessage.value =
      'No pudimos consultar el estado del pago en este momento.';

    if (intentos.value < MAX_POLL_ATTEMPTS) {
      programar();
    } else {
      detener();
    }
  } finally {
    loading.value = false;
  }
}

const reintentar = (): void => {
  intentos.value = 0;
  loading.value = true;
  errorMessage.value = '';
  void consultar();
};

const estadoLabel = computed(() =>
  pago.value ? ESTADO_PAGO_LABELS[pago.value.estado] : '',
);

const badgeClass = computed(() => {
  switch (pago.value?.estado) {
    case 'PAGADO':
      return 'badge-success';
    case 'CANCELADO':
    case 'FALLIDO':
      return 'badge-error';
    default:
      return 'badge-warning';
  }
});

onMounted(() => {
  void consultar();
});

onUnmounted(detener);
</script>

<template>
  <div>
    <section class="bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white">
      <div class="container mx-auto px-4 md:px-8 py-12 md:py-16">
        <h1 class="text-3xl md:text-4xl font-bold">Estado de tu pago</h1>
        <p class="mt-3 max-w-3xl opacity-95">
          Estamos verificando con la pasarela el resultado de tu transferencia.
        </p>
      </div>
    </section>

    <div class="container mx-auto px-4 md:px-8 py-12 max-w-3xl">
      <div
        v-if="loading && !pago"
        class="card bg-base-100 shadow-lg border border-base-200"
      >
        <div class="card-body items-center py-12 gap-4">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <p class="text-sm text-base-content/70">
            Consultando el estado del pago…
          </p>
        </div>
      </div>

      <div
        v-else-if="pago"
        class="card bg-base-100 shadow-lg border border-base-200"
      >
        <div class="card-body gap-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="card-title text-xl">Detalle del cobro</h2>
            <span class="badge badge-lg" :class="badgeClass">
              {{ estadoLabel }}
            </span>
          </div>

          <dl class="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt class="text-base-content/60">Monto</dt>
              <dd class="text-xl font-bold">{{ formatCurrency(pago.monto) }}</dd>
            </div>
            <div>
              <dt class="text-base-content/60">Motivo</dt>
              <dd class="font-medium">{{ pago.asunto }}</dd>
            </div>
            <div>
              <dt class="text-base-content/60">Referencia</dt>
              <dd class="font-mono text-xs">{{ pago.transaction_id }}</dd>
            </div>
            <div v-if="pago.banco">
              <dt class="text-base-content/60">Banco</dt>
              <dd class="font-medium">{{ pago.banco }}</dd>
            </div>
            <div v-if="pago.pagado_en">
              <dt class="text-base-content/60">Fecha de pago</dt>
              <dd class="font-medium">{{ formatDateTime(pago.pagado_en) }}</dd>
            </div>
          </dl>

          <output v-if="pago.estado === 'PAGADO'" class="alert alert-success">
            <span>
              ¡Pago confirmado! La directiva conciliará este aporte con la
              contabilidad del CGPA. Conserva el comprobante que envía la pasarela.
            </span>
          </output>

          <div v-else-if="pago.estado === 'PENDIENTE'" class="alert alert-info">
            <span
              v-if="intentos < MAX_POLL_ATTEMPTS"
              class="loading loading-spinner loading-sm"
            ></span>
            <span class="text-sm">
              {{
                intentos < MAX_POLL_ATTEMPTS
                  ? 'Tu pago está pendiente de confirmación bancaria. Esta página se actualizará automáticamente.'
                  : 'El pago sigue pendiente de confirmación bancaria. Puede tardar algunos minutos: usa «Actualizar estado» para volver a consultar.'
              }}
            </span>
          </div>

          <div v-else class="alert alert-error">
            <span>
              El pago no se completó. Puedes intentarlo nuevamente desde el
              formulario de pago.
            </span>
          </div>

          <div v-if="errorMessage" class="alert alert-warning" role="status">
            <span class="text-sm">{{ errorMessage }}</span>
          </div>

          <div class="card-actions justify-end">
            <button type="button" class="btn btn-ghost" @click="reintentar">
              Actualizar estado
            </button>
            <RouterLink to="/pagar" class="btn btn-primary">
              Realizar otro pago
            </RouterLink>
          </div>
        </div>
      </div>

      <div v-else class="card bg-base-100 shadow-lg border border-base-200">
        <div class="card-body gap-4">
          <h2 class="card-title text-xl">No pudimos mostrar el pago</h2>
          <p class="text-sm text-base-content/70">{{ errorMessage }}</p>
          <div class="card-actions justify-end">
            <button type="button" class="btn btn-primary" @click="reintentar">
              Reintentar
            </button>
          </div>
        </div>
      </div>

      <p class="text-center text-sm mt-8">
        <RouterLink to="/" class="link link-primary">
          Volver al inicio
        </RouterLink>
      </p>
    </div>
  </div>
</template>

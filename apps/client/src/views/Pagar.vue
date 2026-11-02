<script setup lang="ts">
/**
 * Página pública del botón de pago.
 *
 * El apoderado indica sus datos, el motivo y el monto; el backend crea el cobro
 * con la pasarela configurada y devuelve la URL del portal de pago, a la que se
 * redirige para completar la transacción.
 */
import { reactive, ref } from 'vue';
import apiClient from '../plugins/axios';
import { usePageMeta } from '../composables/usePageMeta';
import {
  PROVEEDOR_PAGO_LABELS,
  PROVEEDOR_PAGO_PREDETERMINADO,
  PAGO_MONTO_MAXIMO,
  PAGO_MONTO_MINIMO,
} from '@cgpa/shared';
import { formatCurrency } from '../utils/format';
import {
  PAGO_MONTO_PREDETERMINADO,
  buildPagoPayload,
  createDefaultPagoForm,
  redirectToPaymentPortal,
  validatePagoForm,
  type PagoFormErrors,
} from '../utils/pago-form';

usePageMeta('Pagar');

const form = reactive(createDefaultPagoForm());

const errors = ref<PagoFormErrors>({});
const submitting = ref(false);
const errorMessage = ref('');

const proveedor = PROVEEDOR_PAGO_LABELS[PROVEEDOR_PAGO_PREDETERMINADO];
const montoMinimo = formatCurrency(PAGO_MONTO_MINIMO);
const montoMaximo = formatCurrency(PAGO_MONTO_MAXIMO);

const resetFeedback = (): void => {
  errors.value = {};
  errorMessage.value = '';
};

const handleSubmit = async (): Promise<void> => {
  resetFeedback();

  const validationErrors = validatePagoForm(form);
  if (Object.keys(validationErrors).length > 0) {
    errors.value = validationErrors;
    return;
  }

  submitting.value = true;

  try {
    const { data } = await apiClient.post(
      `/pagos/${PROVEEDOR_PAGO_PREDETERMINADO}`,
      buildPagoPayload(form),
    );

    const paymentUrl = data?.payment_url;

    if (typeof paymentUrl !== 'string' || paymentUrl.length === 0) {
      throw new Error('La respuesta no incluye una URL de pago');
    }

    redirectToPaymentPortal(paymentUrl);
  } catch {
    errorMessage.value =
      'No pudimos iniciar el pago. Intenta nuevamente en unos minutos.';
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div>
    <section class="bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white">
      <div class="container mx-auto px-4 md:px-8 py-12 md:py-16">
        <h1 class="text-3xl md:text-4xl font-bold">Pagar cuota</h1>
        <p class="mt-3 max-w-3xl opacity-95">
          Realiza tu aporte al Centro General de Padres y Apoderados mediante una
          transferencia bancaria simplificada. Serás redirigido al portal seguro
          de {{ proveedor }} para completar el pago.
        </p>
      </div>
    </section>

    <div class="container mx-auto px-4 md:px-8 py-12 grid gap-10 lg:grid-cols-3">
      <!-- Cómo funciona -->
      <section class="lg:col-span-1 space-y-6">
        <div class="card bg-base-100 shadow-lg border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg">¿Cómo funciona?</h2>
            <ol class="mt-2 space-y-4 text-sm list-decimal list-inside">
              <li>
                Completa tus datos y el monto del aporte en el formulario.
              </li>
              <li>
                Te redirigimos a {{ proveedor }}, donde podrás transferir desde tu
                banco de forma segura.
              </li>
              <li>
                Al volver a este sitio verás el estado del pago. La directiva lo
                conciliará con la contabilidad del CGPA.
              </li>
            </ol>

            <div class="alert alert-info mt-4">
              <span class="text-sm">
                Nunca solicitamos claves bancarias. La transacción se realiza
                íntegramente en el portal de {{ proveedor }}.
              </span>
            </div>

            <dl class="mt-2 space-y-3 text-sm">
              <div>
                <dt class="text-base-content/60">Monto mínimo</dt>
                <dd class="font-medium">{{ montoMinimo }}</dd>
              </div>
              <div>
                <dt class="text-base-content/60">Monto máximo por operación</dt>
                <dd class="font-medium">{{ montoMaximo }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <!-- Formulario -->
      <section class="lg:col-span-2">
        <div class="card bg-base-100 shadow-lg border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-xl">Datos del pago</h2>
            <p class="text-sm text-base-content/70">
              Los campos marcados con asterisco son obligatorios. Usa el mismo
              correo con el que te comunicas con la directiva.
            </p>

            <form class="mt-6 space-y-5" novalidate @submit.prevent="handleSubmit">
              <div class="grid gap-5 md:grid-cols-2">
                <div class="form-control">
                  <label class="label" for="pago-nombre">
                    <span class="label-text">Nombre completo *</span>
                  </label>
                  <input
                    id="pago-nombre"
                    v-model="form.nombre"
                    type="text"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': errors.nombre }"
                    autocomplete="name"
                    maxlength="120"
                  />
                  <p v-if="errors.nombre" class="text-error text-xs mt-1">
                    {{ errors.nombre }}
                  </p>
                </div>

                <div class="form-control">
                  <label class="label" for="pago-email">
                    <span class="label-text">Correo electrónico *</span>
                  </label>
                  <input
                    id="pago-email"
                    v-model="form.email"
                    type="email"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': errors.email }"
                    autocomplete="email"
                    maxlength="160"
                  />
                  <p v-if="errors.email" class="text-error text-xs mt-1">
                    {{ errors.email }}
                  </p>
                </div>

                <div class="form-control">
                  <label class="label" for="pago-concepto">
                    <span class="label-text">Motivo del pago *</span>
                  </label>
                  <input
                    id="pago-concepto"
                    v-model="form.concepto"
                    type="text"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': errors.concepto }"
                    maxlength="200"
                  />
                  <p v-if="errors.concepto" class="text-error text-xs mt-1">
                    {{ errors.concepto }}
                  </p>
                </div>

                <div class="form-control">
                  <label class="label" for="pago-monto">
                    <span class="label-text">Monto en pesos (CLP) *</span>
                  </label>
                  <input
                    id="pago-monto"
                    v-model="form.monto"
                    type="text"
                    inputmode="numeric"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': errors.monto }"
                    :placeholder="PAGO_MONTO_PREDETERMINADO"
                    autocomplete="off"
                  />
                  <p v-if="errors.monto" class="text-error text-xs mt-1">
                    {{ errors.monto }}
                  </p>
                </div>
              </div>

              <div v-if="errorMessage" class="alert alert-error" role="alert">
                <span>{{ errorMessage }}</span>
              </div>

              <div class="card-actions justify-end">
                <button
                  type="submit"
                  class="btn btn-primary gap-2"
                  :disabled="submitting"
                >
                  <span
                    v-if="submitting"
                    class="loading loading-spinner loading-sm"
                  ></span>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-5 h-5"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                    />
                  </svg>
                  Pagar con {{ proveedor }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

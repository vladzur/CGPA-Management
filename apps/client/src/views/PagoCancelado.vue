<script setup lang="ts">
/**
 * Página de retorno cuando el apoderado cancela el pago en el portal.
 */
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();

const transactionId = computed(() => {
  const raw = route.query.transaction_id;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
});
</script>

<template>
  <div>
    <section class="bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white">
      <div class="container mx-auto px-4 md:px-8 py-12 md:py-16">
        <h1 class="text-3xl md:text-4xl font-bold">Pago cancelado</h1>
        <p class="mt-3 max-w-3xl opacity-95">
          No se completó la transacción. No se realizó ningún cargo.
        </p>
      </div>
    </section>

    <div class="container mx-auto px-4 md:px-8 py-12 max-w-3xl">
      <div class="card bg-base-100 shadow-lg border border-base-200">
        <div class="card-body gap-5">
          <h2 class="card-title text-xl">¿Quieres intentarlo nuevamente?</h2>
          <p class="text-sm text-base-content/70">
            Puedes volver al formulario de pago y generar un nuevo cobro cuando
            lo necesites.
          </p>

          <dl v-if="transactionId" class="text-sm">
            <dt class="text-base-content/60">Referencia del intento</dt>
            <dd class="font-mono text-xs">{{ transactionId }}</dd>
          </dl>

          <div class="card-actions justify-end">
            <RouterLink to="/" class="btn btn-ghost">Volver al inicio</RouterLink>
            <RouterLink to="/pagar" class="btn btn-primary">
              Reintentar el pago
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

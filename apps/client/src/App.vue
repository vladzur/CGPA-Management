<script setup lang="ts">
/**
 * Componente raíz de la aplicación.
 * El encabezado y el pie institucionales viven en `PublicLayout` (sitio público)
 * y en `AdminLayout` (panel de administración), de modo que aquí solo se resuelve
 * la ruta activa.
 */
import { nextTick, onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { signalPrerenderReady } from './utils/prerender';

onMounted(async () => {
  await nextTick();
  // Se avisa al script de prerender que el contenido de la ruta ya está en el DOM.
  signalPrerenderReady();
});
</script>

<template>
  <RouterView />
</template>

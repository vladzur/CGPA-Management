<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import MarkdownRenderer from '../components/MarkdownRenderer.vue';

interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  estado: string;
  fecha_publicacion: any;
  fecha_creacion: any;
  creado_por: { uid: string; nombre: string };
}

const comunicados = ref<Comunicado[]>([]);
const loading = ref(true);

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value._seconds) return new Date(value._seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatearFecha = (timestamp: any): string => {
  const date = toDate(timestamp);
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(date);
};

const fetchComunicados = async () => {
  loading.value = true;
  try {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const res = await axios.get(`${baseURL}/api/comunicados/publicos`);
    comunicados.value = res.data;
  } catch (err: any) {
    console.error('Error al cargar comunicados:', err);
    comunicados.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchComunicados();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-8">
    <!-- Hero -->
    <div class="hero bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white rounded-2xl shadow-xl">
      <div class="hero-content text-center py-12">
        <div class="max-w-2xl">
          <h1 class="text-4xl font-bold mb-4">Comunicados CGPA</h1>
          <p class="text-lg opacity-90">
            Informacion oficial del Centro General de Padres y Apoderados del Liceo AGB
          </p>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center my-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Sin comunicados -->
    <div v-else-if="comunicados.length === 0" class="text-center py-12">
      <div class="text-6xl mb-4 opacity-30">📋</div>
      <h2 class="text-2xl font-bold text-gray-500 mb-2">No hay comunicados publicados</h2>
      <p class="text-gray-400">No hay comunicados disponibles en este momento. Vuelve a revisar mas tarde.</p>
    </div>

    <!-- Lista de comunicados -->
    <div v-else class="space-y-6">
      <article
        v-for="com in comunicados"
        :key="com.id"
        class="card bg-base-100 shadow-lg border border-base-200 rounded-2xl overflow-hidden"
      >
        <div class="card-body p-6 md:p-8">
          <div class="mb-4">
            <h2 class="text-2xl font-bold text-liceo-primary">{{ com.titulo }}</h2>
            <div class="flex gap-4 text-sm text-gray-500 mt-2">
              <span>Publicado el {{ formatearFecha(com.fecha_publicacion) }}</span>
              <span>por {{ com.creado_por?.nombre }}</span>
            </div>
          </div>

          <div class="divider my-2"></div>

          <MarkdownRenderer :content="com.contenido" />
        </div>
      </article>
    </div>
  </div>
</template>

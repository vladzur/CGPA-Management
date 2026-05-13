<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

interface DocumentoVerificacion {
  valido: boolean;
  mensaje?: string;
  id?: string;
  titulo?: string;
  descripcion?: string;
  monto?: number;
  fecha_emision?: any;
  rut_emisor?: string;
  hash_integridad?: string;
  fecha_sellado?: any;
  creado_por?: { uid: string; nombre: string };
}

const route = useRoute();
const documento = ref<DocumentoVerificacion | null>(null);
const loading = ref(true);
const error = ref('');

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

const formatearMonto = (monto: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto);
};

const fetchDocumento = async () => {
  loading.value = true;
  error.value = '';
  try {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const uuid = route.params.uuid as string;
    const res = await axios.get(`${baseURL}/documentos/validar/${uuid}`);
    documento.value = res.data;
  } catch (err: any) {
    error.value = 'No se pudo conectar con el servidor de verificación.';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDocumento();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 max-w-2xl">
    <!-- Hero -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-liceo-primary mb-2">
        Verificación de Documento
      </h1>
      <p class="text-gray-500">
        Centro General de Padres y Apoderados — Liceo AGB
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center my-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error de conexión -->
    <div v-else-if="error" class="card bg-base-100 shadow-lg border border-error/30">
      <div class="card-body text-center py-12">
        <div class="text-6xl mb-4">&#10060;</div>
        <h2 class="text-2xl font-bold text-error mb-2">Error de Conexión</h2>
        <p class="text-gray-500">{{ error }}</p>
      </div>
    </div>

    <!-- Documento NO encontrado -->
    <div v-else-if="documento && !documento.valido" class="card bg-base-100 shadow-lg border border-error/30">
      <div class="card-body text-center py-12">
        <div class="text-6xl mb-4">&#10060;</div>
        <h2 class="text-2xl font-bold text-error mb-2">Documento No Válido</h2>
        <p class="text-gray-500">{{ documento.mensaje }}</p>
        <p class="text-sm text-gray-400 mt-4">
          Si crees que esto es un error, contacta a la directiva del CGPA.
        </p>
      </div>
    </div>

    <!-- Documento VÁLIDO -->
    <div v-else-if="documento && documento.valido" class="space-y-4">
      <!-- Banner de validación -->
      <div class="card bg-success/10 border border-success/30 shadow-lg">
        <div class="card-body text-center py-8">
          <div class="text-6xl mb-4">&#9989;</div>
          <h2 class="text-2xl font-bold text-success mb-2">Documento Válido</h2>
          <p class="text-gray-600">
            Este documento fue emitido oficialmente por el CGPA y no ha sido alterado.
          </p>
        </div>
      </div>

      <!-- Datos del documento -->
      <div class="card bg-base-100 shadow-lg border border-base-200">
        <div class="card-body p-6 md:p-8">
          <h3 class="text-xl font-bold text-liceo-primary mb-4">{{ documento.titulo }}</h3>

          <div class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-base-200">
              <span class="text-sm text-gray-500">Monto</span>
              <span class="sm:col-span-2 font-semibold text-lg">{{ formatearMonto(documento.monto!) }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-base-200">
              <span class="text-sm text-gray-500">Fecha de Emisión</span>
              <span class="sm:col-span-2">{{ formatearFecha(documento.fecha_emision) }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-base-200">
              <span class="text-sm text-gray-500">RUT Emisor</span>
              <span class="sm:col-span-2">{{ documento.rut_emisor }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-base-200">
              <span class="text-sm text-gray-500">Descripción</span>
              <span class="sm:col-span-2">{{ documento.descripcion }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-base-200">
              <span class="text-sm text-gray-500">Emitido por</span>
              <span class="sm:col-span-2">{{ documento.creado_por?.nombre }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-base-200">
              <span class="text-sm text-gray-500">Fecha de Sellado</span>
              <span class="sm:col-span-2">{{ formatearFecha(documento.fecha_sellado) }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2">
              <span class="text-sm text-gray-500">Hash de Integridad</span>
              <span class="sm:col-span-2 font-mono text-xs bg-base-200 p-2 rounded break-all">
                <span class="font-bold text-liceo-primary">{{ documento.hash_integridad?.substring(0, 8) }}</span>{{ documento.hash_integridad?.substring(8) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p class="text-center text-xs text-gray-400">
        Verificación realizada el {{ formatearFecha(new Date().toISOString()) }}.
        Sistema de Verificación de Integridad CGPA v1.0
      </p>
    </div>
  </div>
</template>

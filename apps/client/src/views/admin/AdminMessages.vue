<script setup lang="ts">
/**
 * Bandeja de mensajes recibidos desde el formulario de contacto del sitio público.
 * Solo es accesible para administradores activos (el backend valida el rol).
 */
import { computed, onMounted, ref } from 'vue';
import {
  MENSAJE_MOTIVO_LABELS,
  type Mensaje,
  type MensajeEstado,
} from '@cgpa/shared';
import apiClient from '../../plugins/axios';
import { formatDateTime } from '../../utils/format';

type MessageWithId = Mensaje & { id: string };

const ESTADO_LABELS: Record<MensajeEstado, string> = {
  NUEVO: 'Nuevo',
  LEIDO: 'Leído',
  ARCHIVADO: 'Archivado',
};

const ESTADO_BADGES: Record<MensajeEstado, string> = {
  NUEVO: 'badge-primary',
  LEIDO: 'badge-ghost',
  ARCHIVADO: 'badge-neutral',
};

const messages = ref<MessageWithId[]>([]);
const loading = ref(true);
const error = ref('');
const estadoFilter = ref<MensajeEstado | ''>('');
const processingId = ref('');

const unreadCount = computed(
  () => messages.value.filter((message) => message.estado === 'NUEVO').length,
);

const fetchMessages = async (): Promise<void> => {
  loading.value = true;
  error.value = '';

  try {
    const params = estadoFilter.value ? { estado: estadoFilter.value } : {};
    const { data } = await apiClient.get<MessageWithId[]>('/mensajes', { params });
    messages.value = data;
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error al cargar los mensajes';
  } finally {
    loading.value = false;
  }
};

const changeStatus = async (id: string, estado: MensajeEstado): Promise<void> => {
  processingId.value = id;

  try {
    await apiClient.patch(`/mensajes/${id}`, { estado });
    await fetchMessages();
  } catch (err: any) {
    error.value = err.response?.data?.message || 'No se pudo actualizar el mensaje';
  } finally {
    processingId.value = '';
  }
};

const removeMessage = async (id: string): Promise<void> => {
  if (!confirm('¿Eliminar este mensaje de la bandeja? Esta acción no se puede deshacer.')) {
    return;
  }

  processingId.value = id;

  try {
    await apiClient.delete(`/mensajes/${id}`);
    await fetchMessages();
  } catch (err: any) {
    error.value = err.response?.data?.message || 'No se pudo eliminar el mensaje';
  } finally {
    processingId.value = '';
  }
};

onMounted(fetchMessages);
</script>

<template>
  <div class="container mx-auto p-4 md:p-8">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold text-base-content">Mensajes recibidos</h1>
        <p class="text-base-content/70 mt-2">
          Consultas enviadas desde el formulario de contacto del sitio web.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <span class="badge badge-lg">{{ unreadCount }} sin leer</span>
        <label for="message-status-filter" class="sr-only">
          Filtrar mensajes por estado
        </label>
        <select
          id="message-status-filter"
          v-model="estadoFilter"
          class="select select-bordered select-sm"
          @change="fetchMessages"
        >
          <option value="">Todos los estados</option>
          <option value="NUEVO">Nuevos</option>
          <option value="LEIDO">Leídos</option>
          <option value="ARCHIVADO">Archivados</option>
        </select>
      </div>
    </div>

    <div v-if="error" class="alert alert-error mb-6">
      <span>{{ error }}</span>
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-bars loading-lg text-primary"></span>
    </div>

    <div v-else-if="messages.length === 0" class="card bg-base-100 border border-dashed border-base-300">
      <div class="card-body items-center text-center py-14">
        <h2 class="card-title">No hay mensajes</h2>
        <p class="text-base-content/70 max-w-lg">
          Cuando un apoderado envíe una consulta desde la página de contacto, aparecerá
          en esta bandeja con su fecha y el motivo indicado.
        </p>
      </div>
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="message in messages"
        :key="message.id"
        class="card bg-base-100 shadow-md border border-base-200"
      >
        <div class="card-body">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h2 class="card-title text-lg">{{ message.nombre }}</h2>
                <span class="badge badge-sm" :class="ESTADO_BADGES[message.estado]">
                  {{ ESTADO_LABELS[message.estado] }}
                </span>
                <span class="badge badge-outline badge-sm">
                  {{ MENSAJE_MOTIVO_LABELS[message.motivo] }}
                </span>
              </div>
              <p class="text-xs text-base-content/60 mt-2">
                {{ formatDateTime(message.fecha_creacion) }}
              </p>
            </div>

            <div class="flex gap-2">
              <button
                v-if="message.estado !== 'LEIDO'"
                type="button"
                class="btn btn-ghost btn-xs"
                :disabled="processingId === message.id"
                @click="changeStatus(message.id, 'LEIDO')"
              >
                Marcar como leído
              </button>
              <button
                v-if="message.estado !== 'ARCHIVADO'"
                type="button"
                class="btn btn-ghost btn-xs"
                :disabled="processingId === message.id"
                @click="changeStatus(message.id, 'ARCHIVADO')"
              >
                Archivar
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs text-error"
                :disabled="processingId === message.id"
                @click="removeMessage(message.id)"
              >
                Eliminar
              </button>
            </div>
          </div>

          <div class="divider my-2"></div>

          <p class="whitespace-pre-line text-sm text-base-content/80">
            {{ message.mensaje }}
          </p>

          <dl class="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
            <div>
              <dt class="text-base-content/60">Correo</dt>
              <dd>
                <a :href="`mailto:${message.email}`" class="link link-primary">
                  {{ message.email }}
                </a>
              </dd>
            </div>
            <div>
              <dt class="text-base-content/60">Teléfono</dt>
              <dd>{{ message.telefono || 'No indicado' }}</dd>
            </div>
          </dl>

          <p
            v-if="message.atendido_por"
            class="text-xs text-base-content/50 mt-3"
          >
            Atendido por {{ message.atendido_por.nombre }}
          </p>
        </div>
      </article>
    </div>
  </div>
</template>

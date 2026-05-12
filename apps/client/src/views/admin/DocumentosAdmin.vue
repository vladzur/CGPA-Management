<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '../../plugins/axios';

interface Documento {
  id: string;
  titulo: string;
  descripcion: string;
  monto: number;
  fecha_emision: any;
  rut_emisor: string;
  estado: 'BORRADOR' | 'SELLADO';
  creado_por: { uid: string; nombre: string };
  fecha_creacion: any;
  fecha_actualizacion?: any;
  hash_integridad?: string;
  uuid_verificacion?: string;
  fecha_sellado?: any;
}

const documentos = ref<Documento[]>([]);
const loading = ref(true);
const error = ref('');
const filtroEstado = ref('');

const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingDocumento = ref<Documento | null>(null);
const isSubmitting = ref(false);
const errorMsg = ref('');

const newForm = ref({
  titulo: '',
  descripcion: '',
  monto: 0,
  fecha_emision: '',
  rut_emisor: '',
  estado: 'BORRADOR' as 'BORRADOR' | 'SELLADO',
});

const editForm = ref({
  titulo: '',
  descripcion: '',
  rut_emisor: '',
});

const fetchDocumentos = async () => {
  loading.value = true;
  error.value = '';
  try {
    const params: any = {};
    if (filtroEstado.value) params.estado = filtroEstado.value;
    const res = await apiClient.get('/documentos', { params });
    documentos.value = res.data;
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error al cargar documentos';
  } finally {
    loading.value = false;
  }
};

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
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const formatearFechaCorta = (timestamp: any): string => {
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

const openCreateModal = () => {
  errorMsg.value = '';
  newForm.value = {
    titulo: '',
    descripcion: '',
    monto: 0,
    fecha_emision: '',
    rut_emisor: '',
    estado: 'BORRADOR',
  };
  showCreateModal.value = true;
};

const submitCreate = async () => {
  errorMsg.value = '';
  isSubmitting.value = true;
  try {
    const payload = {
      titulo: newForm.value.titulo,
      descripcion: newForm.value.descripcion,
      monto: newForm.value.monto,
      fecha_emision: newForm.value.fecha_emision
        ? new Date(newForm.value.fecha_emision).toISOString()
        : new Date().toISOString(),
      rut_emisor: newForm.value.rut_emisor,
      estado: newForm.value.estado,
    };

    await apiClient.post('/documentos', payload);
    showCreateModal.value = false;
    await fetchDocumentos();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || 'Error al crear documento';
    if (Array.isArray(err.response?.data?.errors)) {
      errorMsg.value = err.response.data.errors.join(' | ');
    }
  } finally {
    isSubmitting.value = false;
  }
};

const openEditModal = (documento: Documento) => {
  errorMsg.value = '';
  editingDocumento.value = documento;
  editForm.value = {
    titulo: documento.titulo,
    descripcion: documento.descripcion,
    rut_emisor: documento.rut_emisor,
  };
  showEditModal.value = true;
};

const submitEdit = async () => {
  if (!editingDocumento.value) return;
  errorMsg.value = '';
  isSubmitting.value = true;
  try {
    await apiClient.patch(`/documentos/${editingDocumento.value.id}`, editForm.value);
    showEditModal.value = false;
    await fetchDocumentos();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || 'Error al actualizar documento';
    if (Array.isArray(err.response?.data?.errors)) {
      errorMsg.value = err.response.data.errors.join(' | ');
    }
  } finally {
    isSubmitting.value = false;
  }
};

const sellarDocumento = async (documento: Documento) => {
  if (!confirm(`¿Sellar "${documento.titulo}"? Una vez sellado no podrá ser modificado.`)) return;
  try {
    await apiClient.post(`/documentos/${documento.id}/sellar`);
    await fetchDocumentos();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al sellar documento');
  }
};

const downloadPDF = async (documento: Documento) => {
  try {
    const response = await apiClient.get(`/documentos/${documento.id}/pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${documento.titulo.replace(/\s+/g, '_')}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al descargar PDF');
  }
};

const deleteDocumento = async (documento: Documento) => {
  if (!confirm(`¿Eliminar "${documento.titulo}"? Esta acción no se puede deshacer.`)) return;
  try {
    await apiClient.delete(`/documentos/${documento.id}`);
    await fetchDocumentos();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al eliminar');
  }
};

const estadoBadgeClass = (estado: string) => {
  return estado === 'SELLADO' ? 'badge-success' : 'badge-ghost';
};

onMounted(() => {
  fetchDocumentos();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-liceo-primary">Gestión de Documentos</h1>
      <button @click="openCreateModal" class="btn btn-primary bg-liceo-primary border-none text-white">
        + Nuevo Documento
      </button>
    </div>

    <!-- Filtros -->
    <div class="flex gap-2">
      <button
        class="btn btn-sm"
        :class="filtroEstado === '' ? 'btn-primary' : 'btn-ghost'"
        @click="filtroEstado = ''; fetchDocumentos()"
      >
        Todos
      </button>
      <button
        class="btn btn-sm"
        :class="filtroEstado === 'BORRADOR' ? 'btn-primary' : 'btn-ghost'"
        @click="filtroEstado = 'BORRADOR'; fetchDocumentos()"
      >
        Borradores
      </button>
      <button
        class="btn btn-sm"
        :class="filtroEstado === 'SELLADO' ? 'btn-primary' : 'btn-ghost'"
        @click="filtroEstado = 'SELLADO'; fetchDocumentos()"
      >
        Sellados
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center my-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Lista vacía -->
    <div v-else-if="documentos.length === 0" class="alert">
      <span>No hay documentos{{ filtroEstado ? ' en estado ' + filtroEstado : '' }}.</span>
    </div>

    <!-- Lista de documentos -->
    <div v-else class="grid grid-cols-1 gap-4">
      <div
        v-for="doc in documentos"
        :key="doc.id"
        class="card bg-base-100 shadow-md border border-base-200"
      >
        <div class="card-body">
          <div class="flex justify-between items-start">
            <div class="space-y-1 flex-1">
              <div class="flex gap-2 items-center">
                <h2 class="card-title text-lg">{{ doc.titulo }}</h2>
                <span class="badge" :class="estadoBadgeClass(doc.estado)">
                  {{ doc.estado === 'SELLADO' ? 'Sellado' : 'Borrador' }}
                </span>
              </div>
              <p class="text-sm text-gray-500">{{ doc.descripcion }}</p>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                <span class="font-semibold text-liceo-primary">{{ formatearMonto(doc.monto) }}</span>
                <span>RUT: {{ doc.rut_emisor }}</span>
                <span>{{ formatearFechaCorta(doc.fecha_emision) }}</span>
                <span>Creado por {{ doc.creado_por?.nombre }}</span>
                <span v-if="doc.fecha_sellado">Sellado: {{ formatearFecha(doc.fecha_sellado) }}</span>
              </div>
              <div v-if="doc.hash_integridad" class="text-xs text-gray-400 font-mono mt-1">
                Hash: {{ doc.hash_integridad.substring(0, 16) }}...
              </div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button
                v-if="doc.estado === 'BORRADOR'"
                @click="openEditModal(doc)"
                class="btn btn-sm btn-ghost"
              >
                Editar
              </button>
              <button
                v-if="doc.estado === 'BORRADOR'"
                @click="sellarDocumento(doc)"
                class="btn btn-sm btn-success text-white"
              >
                Sellar
              </button>
              <button
                v-if="doc.estado === 'SELLADO'"
                @click="downloadPDF(doc)"
                class="btn btn-sm btn-primary"
              >
                Descargar PDF
              </button>
              <button
                @click="deleteDocumento(doc)"
                class="btn btn-sm btn-ghost text-error"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear -->
    <dialog class="modal" :class="{ 'modal-open': showCreateModal }">
      <div class="modal-box max-w-xl">
        <h3 class="font-bold text-lg mb-4 text-liceo-primary">Nuevo Documento</h3>

        <div v-if="errorMsg" class="alert alert-error mb-4 text-white">
          <span>{{ errorMsg }}</span>
        </div>

        <form @submit.prevent="submitCreate" class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Título</span></label>
            <input v-model="newForm.titulo" type="text" class="input input-bordered" required />
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Descripción</span></label>
            <textarea v-model="newForm.descripcion" class="textarea textarea-bordered h-24" required></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Monto</span></label>
              <input v-model.number="newForm.monto" type="number" min="0" class="input input-bordered" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">RUT Emisor</span></label>
              <input v-model="newForm.rut_emisor" type="text" class="input input-bordered" placeholder="12.345.678-9" required />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Fecha de Emisión</span></label>
              <input v-model="newForm.fecha_emision" type="datetime-local" class="input input-bordered" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Estado</span></label>
              <select v-model="newForm.estado" class="select select-bordered">
                <option value="BORRADOR">Borrador</option>
                <option value="SELLADO">Sellado</option>
              </select>
            </div>
          </div>

          <div class="modal-action">
            <button type="button" class="btn" @click="showCreateModal = false" :disabled="isSubmitting">Cancelar</button>
            <button type="submit" class="btn btn-primary bg-liceo-primary border-none text-white" :disabled="isSubmitting">
              <span v-if="isSubmitting" class="loading loading-spinner"></span>
              Crear
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showCreateModal = false">close</button>
      </form>
    </dialog>

    <!-- Modal Editar -->
    <dialog class="modal" :class="{ 'modal-open': showEditModal }">
      <div class="modal-box max-w-xl">
        <h3 class="font-bold text-lg mb-4 text-liceo-primary">Editar Documento</h3>

        <div v-if="errorMsg" class="alert alert-error mb-4 text-white">
          <span>{{ errorMsg }}</span>
        </div>

        <form @submit.prevent="submitEdit" class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Título</span></label>
            <input v-model="editForm.titulo" type="text" class="input input-bordered" required />
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Descripción</span></label>
            <textarea v-model="editForm.descripcion" class="textarea textarea-bordered h-24" required></textarea>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">RUT Emisor</span></label>
            <input v-model="editForm.rut_emisor" type="text" class="input input-bordered" required />
          </div>

          <p class="text-sm text-gray-400">
            El monto y la fecha de emisión no se pueden modificar. Si necesitas cambiarlos, elimina este documento y crea uno nuevo.
          </p>

          <div class="modal-action">
            <button type="button" class="btn" @click="showEditModal = false" :disabled="isSubmitting">Cancelar</button>
            <button type="submit" class="btn btn-primary bg-liceo-primary border-none text-white" :disabled="isSubmitting">
              <span v-if="isSubmitting" class="loading loading-spinner"></span>
              Guardar
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showEditModal = false">close</button>
      </form>
    </dialog>
  </div>
</template>

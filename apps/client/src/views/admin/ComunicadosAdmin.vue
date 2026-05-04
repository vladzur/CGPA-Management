<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '../../plugins/axios';
import MarkdownRenderer from '../../components/MarkdownRenderer.vue';
import { processImage, formatSize } from '../../utils/imageProcessor';

interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  estado: 'BORRADOR' | 'PUBLICADO';
  fecha_publicacion: any;
  fecha_creacion: any;
  creado_por: { uid: string; nombre: string };
  fecha_actualizacion?: any;
}

const comunicados = ref<Comunicado[]>([]);
const loading = ref(true);
const error = ref('');
const filtroEstado = ref('');

const showCreateModal = ref(false);
const showEditModal = ref(false);
const showPreview = ref(false);
const editingComunicado = ref<Comunicado | null>(null);
const isSubmitting = ref(false);
const isUploading = ref(false);
const errorMsg = ref('');

// Image upload state
const imageFile = ref<File | null>(null);
const imagePreview = ref('');
const imageAlt = ref('');
const imageStats = ref('');

const newForm = ref({
  titulo: '',
  contenido: '',
  estado: 'BORRADOR' as 'BORRADOR' | 'PUBLICADO',
  fecha_publicacion: '',
});

const editForm = ref({
  titulo: '',
  contenido: '',
  estado: 'BORRADOR' as 'BORRADOR' | 'PUBLICADO',
  fecha_publicacion: '',
});

const fetchComunicados = async () => {
  loading.value = true;
  error.value = '';
  try {
    const params: any = {};
    if (filtroEstado.value) params.estado = filtroEstado.value;
    const res = await apiClient.get('/comunicados', { params });
    comunicados.value = res.data;
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error al cargar comunicados';
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

const toDatetimeLocal = (timestamp: any): string => {
  const date = toDate(timestamp);
  if (!date) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const limpiarEstadoImagen = () => {
  imageFile.value = null;
  imagePreview.value = '';
  imageAlt.value = '';
  imageStats.value = '';
};

const openCreateModal = () => {
  errorMsg.value = '';
  showPreview.value = false;
  limpiarEstadoImagen();
  newForm.value = {
    titulo: '',
    contenido: '',
    estado: 'BORRADOR',
    fecha_publicacion: '',
  };
  showCreateModal.value = true;
};

const submitCreate = async () => {
  errorMsg.value = '';
  isSubmitting.value = true;
  try {
    const payload: any = {
      titulo: newForm.value.titulo,
      contenido: newForm.value.contenido,
      estado: newForm.value.estado,
      fecha_publicacion: newForm.value.fecha_publicacion
        ? new Date(newForm.value.fecha_publicacion).toISOString()
        : new Date().toISOString(),
    };

    await apiClient.post('/comunicados', payload);
    showCreateModal.value = false;
    await fetchComunicados();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || 'Error al crear comunicado';
    if (Array.isArray(err.response?.data?.errors)) {
      errorMsg.value = err.response.data.errors.join(' | ');
    }
  } finally {
    isSubmitting.value = false;
  }
};

const openEditModal = (comunicado: Comunicado) => {
  errorMsg.value = '';
  showPreview.value = false;
  limpiarEstadoImagen();
  editingComunicado.value = comunicado;
  editForm.value = {
    titulo: comunicado.titulo,
    contenido: comunicado.contenido,
    estado: comunicado.estado,
    fecha_publicacion: toDatetimeLocal(comunicado.fecha_publicacion),
  };
  showEditModal.value = true;
};

const submitEdit = async () => {
  if (!editingComunicado.value) return;
  errorMsg.value = '';
  isSubmitting.value = true;
  try {
    const payload: any = {
      titulo: editForm.value.titulo,
      contenido: editForm.value.contenido,
      estado: editForm.value.estado,
      fecha_publicacion: editForm.value.fecha_publicacion
        ? new Date(editForm.value.fecha_publicacion).toISOString()
        : undefined,
    };

    await apiClient.patch(`/comunicados/${editingComunicado.value.id}`, payload);
    showEditModal.value = false;
    await fetchComunicados();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || 'Error al actualizar comunicado';
    if (Array.isArray(err.response?.data?.errors)) {
      errorMsg.value = err.response.data.errors.join(' | ');
    }
  } finally {
    isSubmitting.value = false;
  }
};

const deleteComunicado = async (comunicado: Comunicado) => {
  if (!confirm(`Eliminar "${comunicado.titulo}"? Esta accion no se puede deshacer.`)) return;
  try {
    await apiClient.delete(`/comunicados/${comunicado.id}`);
    await fetchComunicados();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al eliminar');
  }
};

const handleImageFile = async (file: File) => {
  if (!file.type.startsWith('image/')) return;

  imageFile.value = file;
  imageAlt.value = file.name.replace(/\.[^.]+$/, '');
  imageStats.value = 'Procesando...';

  // Preview inmediato
  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.value = reader.result as string;
  };
  reader.readAsDataURL(file);

  try {
    const processed = await processImage(file);
    imageFile.value = new File([processed.blob], processed.name, { type: processed.blob.type });
    imageStats.value = `${processed.width}×${processed.height} | ${formatSize(processed.originalSize)} → ${formatSize(processed.compressedSize)}`;
  } catch {
    imageStats.value = formatSize(file.size);
  }
};

const cancelarImagen = () => {
  limpiarEstadoImagen();
};

const insertarImagen = async () => {
  const file = imageFile.value;
  if (!file) return;

  isUploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const res = await apiClient.post('/comunicados/imagenes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const url = res.data.url;
    const mdImage = `![${imageAlt.value || file.name}](${url})`;

    if (showCreateModal.value) {
      newForm.value.contenido += `\n${mdImage}\n`;
    } else if (showEditModal.value) {
      editForm.value.contenido += `\n${mdImage}\n`;
    }

    limpiarEstadoImagen();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al subir imagen');
  } finally {
    isUploading.value = false;
  }
};

const onDropZoneClick = (e: MouseEvent) => {
  const input = (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>('input[type="file"]');
  input?.click();
};

const onDragOver = (e: DragEvent) => {
  e.preventDefault();
  if (e.currentTarget instanceof HTMLElement) {
    e.currentTarget.classList.add('border-liceo-primary');
  }
};

const onDragLeave = (e: DragEvent) => {
  if (e.currentTarget instanceof HTMLElement) {
    e.currentTarget.classList.remove('border-liceo-primary');
  }
};

const onDrop = (e: DragEvent) => {
  e.preventDefault();
  if (e.currentTarget instanceof HTMLElement) {
    e.currentTarget.classList.remove('border-liceo-primary');
  }
  const file = e.dataTransfer?.files?.[0];
  if (file) handleImageFile(file);
};

const onFileInputChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleImageFile(file);
};

const estadoBadgeClass = (estado: string) => {
  return estado === 'PUBLICADO' ? 'badge-success' : 'badge-ghost';
};

const fechaEstadoComunicado = (comunicado: Comunicado): string => {
  if (comunicado.estado === 'BORRADOR') return 'Borrador';
  const fecha = toDate(comunicado.fecha_publicacion);
  if (fecha && fecha <= new Date()) return 'Publicado';
  return `Programado: ${formatearFecha(comunicado.fecha_publicacion)}`;
};

onMounted(() => {
  fetchComunicados();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-liceo-primary">Gestion de Comunicados</h1>
      <button @click="openCreateModal" class="btn btn-primary bg-liceo-primary border-none text-white">
        + Nuevo Comunicado
      </button>
    </div>

    <!-- Filtros -->
    <div class="flex gap-2">
      <button
        class="btn btn-sm"
        :class="filtroEstado === '' ? 'btn-primary' : 'btn-ghost'"
        @click="filtroEstado = ''; fetchComunicados()"
      >
        Todos
      </button>
      <button
        class="btn btn-sm"
        :class="filtroEstado === 'BORRADOR' ? 'btn-primary' : 'btn-ghost'"
        @click="filtroEstado = 'BORRADOR'; fetchComunicados()"
      >
        Borradores
      </button>
      <button
        class="btn btn-sm"
        :class="filtroEstado === 'PUBLICADO' ? 'btn-primary' : 'btn-ghost'"
        @click="filtroEstado = 'PUBLICADO'; fetchComunicados()"
      >
        Publicados
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

    <!-- Lista -->
    <div v-else-if="comunicados.length === 0" class="alert">
      <span>No hay comunicados{{ filtroEstado ? ' en estado ' + filtroEstado : '' }}.</span>
    </div>

    <div v-else class="grid grid-cols-1 gap-4">
      <div
        v-for="com in comunicados"
        :key="com.id"
        class="card bg-base-100 shadow-md border border-base-200"
      >
        <div class="card-body">
          <div class="flex justify-between items-start">
            <div class="space-y-1">
              <h2 class="card-title text-lg">{{ com.titulo }}</h2>
              <div class="flex gap-2 items-center text-sm text-gray-500">
                <span class="badge" :class="estadoBadgeClass(com.estado)">
                  {{ fechaEstadoComunicado(com) }}
                </span>
                <span>Creado por {{ com.creado_por?.nombre }}</span>
                <span>{{ formatearFecha(com.fecha_creacion) }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button @click="openEditModal(com)" class="btn btn-sm btn-ghost">Editar</button>
              <button @click="deleteComunicado(com)" class="btn btn-sm btn-ghost text-error">Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear -->
    <dialog class="modal" :class="{ 'modal-open': showCreateModal }">
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4 text-liceo-primary">Nuevo Comunicado</h3>

        <div v-if="errorMsg" class="alert alert-error mb-4 text-white">
          <span>{{ errorMsg }}</span>
        </div>

        <form @submit.prevent="submitCreate">
          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Titulo</span></label>
            <input v-model="newForm.titulo" type="text" class="input input-bordered" required />
          </div>

          <div class="form-control mb-3">
            <label class="label">
              <span class="label-text">Contenido (Markdown)</span>
              <button type="button" class="btn btn-xs btn-ghost" @click="showPreview = !showPreview">
                {{ showPreview ? 'Editar' : 'Vista previa' }}
              </button>
            </label>
            <textarea
              v-if="!showPreview"
              v-model="newForm.contenido"
              class="textarea textarea-bordered h-48 font-mono text-sm"
              required
            ></textarea>
            <div v-else class="border rounded-lg p-4 min-h-48 bg-base-100">
              <MarkdownRenderer v-if="newForm.contenido" :content="newForm.contenido" />
              <span v-else class="text-gray-400">Sin contenido</span>
            </div>
          </div>

          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Imagen</span></label>

            <!-- Sin imagen seleccionada: drop zone -->
            <div
              v-if="!imageFile"
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-liceo-primary transition-colors cursor-pointer"
              @click="onDropZoneClick"
              @dragover="onDragOver"
              @dragleave="onDragLeave"
              @drop="onDrop"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p class="text-sm text-gray-500">Arrastra una imagen aqui o <span class="text-liceo-primary">haz clic para seleccionar</span></p>
              <p class="text-xs text-gray-400 mt-1">Se redimensionara y comprimira automaticamente</p>
              <input type="file" accept="image/*" class="hidden" @change="onFileInputChange" />
            </div>

            <!-- Imagen seleccionada: preview + datos -->
            <div v-else class="border rounded-lg p-4 bg-base-100 space-y-3">
              <div class="flex gap-4">
                <div class="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                  <img :src="imagePreview" class="w-full h-full object-cover" alt="Preview" />
                </div>
                <div class="flex-1 space-y-2">
                  <div class="text-sm text-gray-600">{{ imageFile.name }}</div>
                  <div class="text-xs text-gray-500">{{ imageStats }}</div>
                  <input
                    v-model="imageAlt"
                    type="text"
                    class="input input-bordered input-sm w-full"
                    placeholder="Texto alternativo (alt)"
                  />
                </div>
              </div>
              <div class="flex gap-2 justify-end">
                <button type="button" class="btn btn-sm btn-ghost" @click="cancelarImagen">Cancelar</button>
                <button type="button" class="btn btn-sm btn-primary" :disabled="isUploading" @click="insertarImagen">
                  <span v-if="isUploading" class="loading loading-spinner loading-xs"></span>
                  Insertar en contenido
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-3">
            <div class="form-control">
              <label class="label"><span class="label-text">Estado</span></label>
              <select v-model="newForm.estado" class="select select-bordered">
                <option value="BORRADOR">Borrador</option>
                <option value="PUBLICADO">Publicado</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Fecha de publicacion</span></label>
              <input v-model="newForm.fecha_publicacion" type="datetime-local" class="input input-bordered" />
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
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4 text-liceo-primary">Editar Comunicado</h3>

        <div v-if="errorMsg" class="alert alert-error mb-4 text-white">
          <span>{{ errorMsg }}</span>
        </div>

        <form @submit.prevent="submitEdit">
          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Titulo</span></label>
            <input v-model="editForm.titulo" type="text" class="input input-bordered" required />
          </div>

          <div class="form-control mb-3">
            <label class="label">
              <span class="label-text">Contenido (Markdown)</span>
              <button type="button" class="btn btn-xs btn-ghost" @click="showPreview = !showPreview">
                {{ showPreview ? 'Editar' : 'Vista previa' }}
              </button>
            </label>
            <textarea
              v-if="!showPreview"
              v-model="editForm.contenido"
              class="textarea textarea-bordered h-48 font-mono text-sm"
              required
            ></textarea>
            <div v-else class="border rounded-lg p-4 min-h-48 bg-base-100">
              <MarkdownRenderer v-if="editForm.contenido" :content="editForm.contenido" />
              <span v-else class="text-gray-400">Sin contenido</span>
            </div>
          </div>

          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Imagen</span></label>

            <!-- Sin imagen seleccionada: drop zone -->
            <div
              v-if="!imageFile"
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-liceo-primary transition-colors cursor-pointer"
              @click="onDropZoneClick"
              @dragover="onDragOver"
              @dragleave="onDragLeave"
              @drop="onDrop"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p class="text-sm text-gray-500">Arrastra una imagen aqui o <span class="text-liceo-primary">haz clic para seleccionar</span></p>
              <p class="text-xs text-gray-400 mt-1">Se redimensionara y comprimira automaticamente</p>
              <input type="file" accept="image/*" class="hidden" @change="onFileInputChange" />
            </div>

            <!-- Imagen seleccionada: preview + datos -->
            <div v-else class="border rounded-lg p-4 bg-base-100 space-y-3">
              <div class="flex gap-4">
                <div class="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                  <img :src="imagePreview" class="w-full h-full object-cover" alt="Preview" />
                </div>
                <div class="flex-1 space-y-2">
                  <div class="text-sm text-gray-600">{{ imageFile.name }}</div>
                  <div class="text-xs text-gray-500">{{ imageStats }}</div>
                  <input
                    v-model="imageAlt"
                    type="text"
                    class="input input-bordered input-sm w-full"
                    placeholder="Texto alternativo (alt)"
                  />
                </div>
              </div>
              <div class="flex gap-2 justify-end">
                <button type="button" class="btn btn-sm btn-ghost" @click="cancelarImagen">Cancelar</button>
                <button type="button" class="btn btn-sm btn-primary" :disabled="isUploading" @click="insertarImagen">
                  <span v-if="isUploading" class="loading loading-spinner loading-xs"></span>
                  Insertar en contenido
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-3">
            <div class="form-control">
              <label class="label"><span class="label-text">Estado</span></label>
              <select v-model="editForm.estado" class="select select-bordered">
                <option value="BORRADOR">Borrador</option>
                <option value="PUBLICADO">Publicado</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Fecha de publicacion</span></label>
              <input v-model="editForm.fecha_publicacion" type="datetime-local" class="input input-bordered" />
            </div>
          </div>

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

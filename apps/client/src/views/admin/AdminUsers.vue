<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '../../plugins/axios';

interface UserData {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  rol: string;
  activo: boolean;
  fecha_registro?: any;
  fecha_aprobacion?: any;
}

type TabName = 'pendientes' | 'todos';

const activeTab = ref<TabName>('pendientes');
const users = ref<UserData[]>([]);
const loading = ref(true);
const error = ref('');
const actionInProgress = ref('');

const selectedRoles = ref<Record<string, string>>({});

const ROLES = ['ADMIN', 'TESORERO', 'APODERADO'];

const tabs: { key: TabName; label: string }[] = [
  { key: 'pendientes', label: 'Pendientes de Aprobacion' },
  { key: 'todos', label: 'Todos los Usuarios' },
];

const fetchUsers = async () => {
  loading.value = true;
  error.value = '';
  try {
    const endpoint = activeTab.value === 'pendientes' ? '/usuarios/pendientes' : '/usuarios';
    const res = await apiClient.get(endpoint);
    users.value = res.data;
    selectedRoles.value = {};
    users.value.forEach(u => {
      selectedRoles.value[u.id] = 'TESORERO';
    });
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error al cargar usuarios';
  } finally {
    loading.value = false;
  }
};

const approveUser = async (uid: string) => {
  actionInProgress.value = uid;
  try {
    const role = selectedRoles.value[uid];
    await apiClient.patch(`/usuarios/${uid}/aprobar`, { rol: role });
    users.value = users.value.filter(u => u.id !== uid);
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al aprobar usuario');
  } finally {
    actionInProgress.value = '';
  }
};

const toggleActive = async (user: UserData) => {
  const accion = user.activo ? 'desactivar' : 'activar';
  if (!confirm(`¿${accion} a ${user.name || user.email}?`)) return;
  actionInProgress.value = user.id;
  try {
    const res = await apiClient.patch(`/usuarios/${user.id}/activar`);
    user.activo = res.data.activo;
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al cambiar estado');
  } finally {
    actionInProgress.value = '';
  }
};

const changeRole = async (user: UserData, newRole: string) => {
  if (!confirm(`¿Cambiar rol de ${user.name || user.email} a ${newRole}?`)) return;
  actionInProgress.value = user.id;
  try {
    await apiClient.patch(`/usuarios/${user.id}/rol`, { rol: newRole });
    user.rol = newRole;
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al cambiar rol');
  } finally {
    actionInProgress.value = '';
  }
};

const deleteUser = async (user: UserData) => {
  if (!confirm(`¿Eliminar permanentemente a ${user.name || user.email}? Esta accion no se puede deshacer.`)) return;
  actionInProgress.value = user.id;
  try {
    await apiClient.delete(`/usuarios/${user.id}`);
    users.value = users.value.filter(u => u.id !== user.id);
  } catch (err: any) {
    alert(err.response?.data?.message || 'Error al eliminar usuario');
  } finally {
    actionInProgress.value = '';
  }
};

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value._seconds) return new Date(value._seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value: any): string => {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
};

const roleBadgeClass = (rol: string) => {
  switch (rol) {
    case 'ADMIN': return 'badge-error';
    case 'TESORERO': return 'badge-warning';
    case 'APODERADO': return 'badge-info';
    default: return 'badge-ghost';
  }
};

onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="container mx-auto p-4 md:p-8 space-y-6">
    <h1 class="text-3xl font-bold">Administracion de Usuarios</h1>

    <!-- Tabs -->
    <div class="tabs tabs-boxed bg-base-100">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ 'tab-active': activeTab === tab.key }"
        @click="activeTab = tab.key; fetchUsers()"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center my-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>{{ error }}</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="users.length === 0" class="alert">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span v-if="activeTab === 'pendientes'">No hay usuarios pendientes de aprobacion.</span>
      <span v-else>No hay usuarios registrados.</span>
    </div>

    <!-- Pending Users Grid -->
    <div v-else-if="activeTab === 'pendientes'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="user in users" :key="user.id" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body">
          <h2 class="card-title">{{ user.name }}</h2>
          <p class="text-base-content/70 text-sm">{{ user.email }}</p>
          <div class="flex gap-2 text-sm text-base-content/50 mt-1">
            <span>Solicitado: {{ formatDate(user.fecha_registro) }}</span>
          </div>

          <div class="form-control mt-2">
            <label class="label py-1"><span class="label-text text-xs">Asignar Rol</span></label>
            <select v-model="selectedRoles[user.id]" class="select select-bordered select-sm">
              <option v-for="rol in ROLES" :key="rol" :value="rol">{{ rol }}</option>
            </select>
          </div>

          <div class="card-actions mt-4">
            <button
              class="btn btn-primary btn-sm flex-1"
              :disabled="actionInProgress === user.id"
              @click="approveUser(user.id)"
            >
              <span v-if="actionInProgress === user.id" class="loading loading-spinner loading-xs"></span>
              Aprobar
            </button>
            <button
              class="btn btn-ghost btn-sm text-error"
              :disabled="actionInProgress === user.id"
              @click="deleteUser(user)"
            >
              Rechazar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- All Users Table -->
    <div v-else class="overflow-x-auto bg-base-100 rounded-box shadow">
      <table class="table table-zebra">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Registro</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>
              <div class="font-medium">{{ user.name }}</div>
              <div class="text-sm text-base-content/60">{{ user.email }}</div>
            </td>
            <td>
              <div class="dropdown dropdown-hover">
                <label tabindex="0" class="badge cursor-pointer" :class="roleBadgeClass(user.rol)">{{ user.rol }}</label>
                <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40 mt-1">
                  <li v-for="rol in ROLES.filter(r => r !== user.rol)" :key="rol">
                    <a @click="changeRole(user, rol)">
                      Cambiar a <span class="badge ml-1" :class="roleBadgeClass(rol)">{{ rol }}</span>
                    </a>
                  </li>
                </ul>
              </div>
            </td>
            <td>
              <span class="badge" :class="user.activo ? 'badge-success' : 'badge-outline text-error'">
                {{ user.activo ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="text-sm text-base-content/60">{{ formatDate(user.fecha_registro) }}</td>
            <td>
              <div class="flex justify-end gap-1">
                <button
                  class="btn btn-xs"
                  :class="user.activo ? 'btn-warning' : 'btn-success'"
                  :disabled="actionInProgress === user.id"
                  @click="toggleActive(user)"
                >
                  <span v-if="actionInProgress === user.id" class="loading loading-spinner loading-xs"></span>
                  {{ user.activo ? 'Desactivar' : 'Activar' }}
                </button>
                <button
                  class="btn btn-xs btn-error btn-outline"
                  :disabled="actionInProgress === user.id"
                  @click="deleteUser(user)"
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

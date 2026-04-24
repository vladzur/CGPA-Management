<template>
  <div class="min-h-screen bg-base-200 p-8">
    <div class="max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">Usuarios Pendientes</h1>
        <router-link to="/admin" class="btn btn-ghost">Volver al Panel</router-link>
      </div>

      <div v-if="loading" class="flex justify-center my-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <div v-else-if="error" class="alert alert-error">
        <span>{{ error }}</span>
      </div>

      <div v-else-if="users.length === 0" class="alert alert-info">
        <span>No hay usuarios pendientes de aprobación.</span>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="user in users" :key="user.id" class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title">{{ user.name }}</h2>
            <p class="text-base-content/70">{{ user.email }}</p>
            <div class="divider my-2"></div>
            <p class="text-sm">Rol Solicitado: <span class="badge badge-outline">{{ user.rol }}</span></p>
            
            <div class="card-actions justify-end mt-4">
              <!-- Select rol -->
              <select v-model="selectedRoles[user.id]" class="select select-bordered select-sm w-full max-w-xs mb-2">
                <option value="TESORERO">Tesorero</option>
                <option value="PRESIDENTE">Presidente</option>
                <option value="ADMIN">Admin</option>
              </select>
              
              <button 
                @click="approveUser(user.id)" 
                class="btn btn-primary btn-sm w-full"
                :disabled="approving === user.id"
              >
                <span v-if="approving === user.id" class="loading loading-spinner loading-xs"></span>
                Aprobar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const users = ref<any[]>([]);
const loading = ref(true);
const error = ref('');
const approving = ref('');
const selectedRoles = ref<Record<string, string>>({});

const fetchUsers = async () => {
  loading.value = true;
  try {
    const res = await fetch('/api/usuarios/pendientes', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });
    if (!res.ok) throw new Error('Error al cargar usuarios');
    users.value = await res.json();
    
    // Init roles select
    users.value.forEach(u => {
      selectedRoles.value[u.id] = 'TESORERO';
    });
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const approveUser = async (uid: string) => {
  approving.value = uid;
  try {
    const role = selectedRoles.value[uid];
    const res = await fetch(`/api/usuarios/${uid}/aprobar`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ rol: role })
    });
    
    if (!res.ok) throw new Error('Error al aprobar usuario');
    
    // Remover de la lista local
    users.value = users.value.filter(u => u.id !== uid);
    
  } catch (err: any) {
    alert(err.message);
  } finally {
    approving.value = '';
  }
};

onMounted(() => {
  fetchUsers();
});
</script>

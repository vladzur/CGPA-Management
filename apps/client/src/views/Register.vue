<template>
  <div class="min-h-screen bg-base-200 flex items-center justify-center">
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title justify-center text-2xl font-bold mb-4">Registro Interno CGPA</h2>
        
        <div v-if="error" class="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{{ error }}</span>
        </div>

        <div v-if="success" class="alert alert-success mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Registro completado. Espera a que un administrador apruebe tu cuenta.</span>
        </div>

        <form v-if="!success" @submit.prevent="handleRegister">
          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Nombre Completo</span>
            </label>
            <input v-model="form.name" type="text" placeholder="Ej. Juan Pérez" class="input input-bordered w-full" required />
          </div>

          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Correo Electrónico</span>
            </label>
            <input v-model="form.email" type="email" placeholder="correo@ejemplo.com" class="input input-bordered w-full" required />
          </div>

          <div class="form-control mb-6">
            <label class="label">
              <span class="label-text">Contraseña</span>
            </label>
            <input v-model="form.password" type="password" placeholder="Min. 6 caracteres" class="input input-bordered w-full" required minlength="6" />
          </div>

          <div class="form-control mt-6">
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <span v-if="loading" class="loading loading-spinner"></span>
              Registrarse
            </button>
          </div>
        </form>
        
        <div class="text-center mt-4" v-if="!success">
          <router-link to="/" class="link link-hover text-sm text-base-content/70">Volver al Dashboard Público</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const form = ref({
  name: '',
  email: '',
  password: ''
});

const loading = ref(false);
const error = ref('');
const success = ref(false);

const handleRegister = async () => {
  loading.value = true;
  error.value = '';
  try {
    await authStore.register(form.value.email, form.value.password, form.value.name);
    success.value = true;
    authStore.logout(); // Cerramos sesión para que no intenten navegar
  } catch (err: any) {
    error.value = err.message || 'Error al registrarse';
  } finally {
    loading.value = false;
  }
};
</script>

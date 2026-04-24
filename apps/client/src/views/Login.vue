<template>
  <div class="min-h-screen bg-base-200 flex items-center justify-center">
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title justify-center text-2xl font-bold mb-4">Iniciar Sesión</h2>
        
        <div v-if="error" class="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{{ error }}</span>
        </div>

        <form @submit.prevent="handleLogin">
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
            <input v-model="form.password" type="password" placeholder="Tu contraseña" class="input input-bordered w-full" required />
          </div>

          <div class="form-control mt-6">
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <span v-if="loading" class="loading loading-spinner"></span>
              Ingresar
            </button>
          </div>
        </form>
        
        <div class="text-center mt-4 flex flex-col gap-2">
          <router-link to="/registro-interno-agb" class="link link-hover text-sm text-primary">¿No tienes cuenta? Regístrate aquí</router-link>
          <router-link to="/" class="link link-hover text-sm text-base-content/70">Volver al inicio</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  email: '',
  password: ''
});

const loading = ref(false);
const error = ref('');

const handleLogin = async () => {
  loading.value = true;
  error.value = '';
  try {
    await authStore.login(form.value.email, form.value.password);
    
    // Verificamos si la cuenta está aprobada para redirigir
    if (authStore.claims?.activo) {
      router.push('/admin');
    } else {
      error.value = 'Tu cuenta aún está pendiente de aprobación por un administrador.';
      authStore.logout();
    }
  } catch (err: any) {
    // Errores comunes de Firebase Auth
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      error.value = 'Correo o contraseña incorrectos.';
    } else {
      error.value = err.message || 'Error al iniciar sesión.';
    }
  } finally {
    loading.value = false;
  }
};
</script>

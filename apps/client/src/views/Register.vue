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

          <div class="divider my-4 text-sm text-base-content/50">o</div>

          <div class="form-control">
            <button type="button" class="btn btn-outline" :disabled="loading" @click="handleGoogleRegister">
              <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Registrarse con Google
            </button>
          </div>
        </form>
        
        <div class="text-center mt-4 flex flex-col gap-2" v-if="!success">
          <router-link to="/login" class="link link-hover text-sm text-primary">¿Ya tienes cuenta? Inicia sesión aquí</router-link>
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

const handleGoogleRegister = async () => {
  loading.value = true;
  error.value = '';
  try {
    await authStore.loginWithGoogle();

    // Registrar al usuario en el backend
    const response = await fetch('/api/usuarios/registro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    if (response.ok) {
      success.value = true;
      authStore.logout();
    } else if (response.status === 400) {
      // Usuario ya registrado previamente
      error.value = 'Ya existe una cuenta con este correo. Inicia sesión en su lugar.';
      authStore.logout();
    } else {
      error.value = 'Error al registrar con Google. Intenta de nuevo.';
      authStore.logout();
    }
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user') {
      error.value = 'Registro con Google cancelado.';
    } else if (err.code === 'auth/account-exists-with-different-credential') {
      error.value = 'Ya existe una cuenta con este correo usando otro método de acceso.';
    } else {
      error.value = err.message || 'Error al registrarse con Google.';
    }
  } finally {
    loading.value = false;
  }
};
</script>

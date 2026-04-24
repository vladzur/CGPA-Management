import { defineStore } from 'pinia';
import { ref } from 'vue';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User
} from 'firebase/auth';
import { app } from '../firebase'; // Asumiendo que firebase.ts inicializa app

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const claims = ref<any>({});
  const isInitialized = ref(false);

  const auth = getAuth(app);

  onAuthStateChanged(auth, async (currentUser) => {
    user.value = currentUser;
    if (currentUser) {
      // Forzar refresh la primera vez para asegurar que tenemos los claims actualizados
      token.value = await currentUser.getIdToken(true);
      const tokenResult = await currentUser.getIdTokenResult();
      claims.value = tokenResult.claims;
    } else {
      token.value = null;
      claims.value = {};
    }
    isInitialized.value = true;
  });

  const register = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    
    // Obtener token para enviarlo al backend
    const currentToken = await userCredential.user.getIdToken(true);
    
    // Llamar al backend para crear el registro en la colección "usuarios"
    const response = await fetch('/api/usuarios/registro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (!response.ok) {
      // Si falla en el backend, idealmente deberíamos borrar el usuario en Firebase Auth
      // o manejar el error adecuadamente.
      throw new Error('Error al registrar usuario en el sistema');
    }
    
    return userCredential.user;
  };

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Forzamos la recarga del token para obtener los claims si acaban de ser aprobados
    token.value = await cred.user.getIdToken(true);
    const tokenResult = await cred.user.getIdTokenResult();
    claims.value = tokenResult.claims;
    return cred.user;
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  // Helper para refrescar token (útil después de ser aprobado)
  const refreshToken = async () => {
    if (user.value) {
      token.value = await user.value.getIdToken(true);
      const tokenResult = await user.value.getIdTokenResult();
      claims.value = tokenResult.claims;
    }
  };

  return {
    user,
    token,
    claims,
    isInitialized,
    register,
    login,
    logout,
    refreshToken
  };
});

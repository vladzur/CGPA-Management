import { describe, it, expect, vi, beforeEach } from 'vitest';

// Las funciones mock deben declararse con vi.hoisted() porque vi.mock se ejecuta antes
const {
  mockOnAuthStateChanged,
  mockSignInWithEmailAndPassword,
  mockCreateUserWithEmailAndPassword,
  mockSignInWithPopup,
  mockGoogleAuthProvider,
  mockSignOut,
  mockUpdateProfile,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockSignInWithEmailAndPassword: vi.fn(),
  mockCreateUserWithEmailAndPassword: vi.fn(),
  mockSignInWithPopup: vi.fn(),
  mockGoogleAuthProvider: vi.fn(),
  mockSignOut: vi.fn(),
  mockUpdateProfile: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: mockOnAuthStateChanged,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  signInWithPopup: mockSignInWithPopup,
  GoogleAuthProvider: mockGoogleAuthProvider,
  signOut: mockSignOut,
  updateProfile: mockUpdateProfile,
}));

vi.mock('../firebase', () => ({
  app: { name: 'mock-app' },
  auth: {},
  db: {},
}));

import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './auth';

describe('Auth Store - loginWithGoogle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Simular auth state inicial sin usuario
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: null) => void) => {
      cb(null);
      return vi.fn(); // unsubscribe
    });
  });

  describe('loginWithGoogle', () => {
    const fakeUser = {
      uid: 'google-uid-123',
      email: 'user@gmail.com',
      displayName: 'Google User',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'PENDIENTE', activo: false },
        token: 'fake-token',
      }),
    };

    it('debe llamar a signInWithPopup con GoogleAuthProvider', async () => {
      mockSignInWithPopup.mockResolvedValue({ user: fakeUser });

      const store = useAuthStore();
      const user = await store.loginWithGoogle();

      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      expect(mockGoogleAuthProvider).toHaveBeenCalledTimes(1);
      expect(user.uid).toBe('google-uid-123');
    });

    it('debe refrescar el token y parsear los claims después del inicio con Google', async () => {
      const adminUser = {
        uid: 'google-uid-456',
        email: 'admin@gmail.com',
        displayName: 'Admin User',
        getIdToken: vi.fn().mockResolvedValue('admin-token'),
        getIdTokenResult: vi.fn().mockResolvedValue({
          claims: { role: 'ADMIN', activo: true },
          token: 'admin-token',
        }),
      };

      mockSignInWithPopup.mockResolvedValue({ user: adminUser });

      const store = useAuthStore();
      await store.loginWithGoogle();

      expect(store.token).toBe('admin-token');
      expect(store.claims).toEqual({ role: 'ADMIN', activo: true });
    });

    it('debe retornar el usuario de Firebase en caso de éxito', async () => {
      mockSignInWithPopup.mockResolvedValue({ user: fakeUser });

      const store = useAuthStore();
      const user = await store.loginWithGoogle();

      expect(user.uid).toBe('google-uid-123');
      expect(user.email).toBe('user@gmail.com');
    });

    it('debe propagar errores de Firebase (popup cerrado)', async () => {
      const firebaseError = {
        code: 'auth/popup-closed-by-user',
        message: 'Pop-up closed by user',
      };
      mockSignInWithPopup.mockRejectedValue(firebaseError);

      const store = useAuthStore();
      await expect(store.loginWithGoogle()).rejects.toEqual(firebaseError);
    });

    it('debe propagar errores de cuenta existente con otra credencial', async () => {
      const firebaseError = {
        code: 'auth/account-exists-with-different-credential',
        message: 'Account exists with different credential',
      };
      mockSignInWithPopup.mockRejectedValue(firebaseError);

      const store = useAuthStore();
      await expect(store.loginWithGoogle()).rejects.toEqual(firebaseError);
    });
  });
});

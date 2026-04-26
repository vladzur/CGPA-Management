/**
 * @file firebase-admin.mock.ts
 * @description Factories centralizadas para crear mocks de Firebase Admin SDK.
 *
 * NOTA IMPORTANTE sobre Firestore:
 * Las propiedades como `exists`, `empty`, `docs` en DocumentSnapshot y QuerySnapshot
 * son PROPIEDADES de solo lectura (no funciones) en la API real de Firestore.
 * Por eso usamos plain objects en lugar de mockDeep para esos tipos, ya que
 * mockDeep genera stubs de función que son incompatibles con el código de producción
 * que los accede con `if (doc.exists)` o `snapshot.docs.map(...)`.
 */
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import * as admin from 'firebase-admin';

// ─── Tipos de mocks profundos (para objetos con métodos) ─────────────────────

export type MockFirestore = DeepMockProxy<admin.firestore.Firestore>;
export type MockAuth = DeepMockProxy<admin.auth.Auth>;
export type MockDocumentReference = DeepMockProxy<admin.firestore.DocumentReference>;
export type MockWriteBatch = DeepMockProxy<admin.firestore.WriteBatch>;
export type MockTransaction = DeepMockProxy<admin.firestore.Transaction>;

// ─── Firestore Builder ────────────────────────────────────────────────────────

export function createMockFirestore(): MockFirestore {
  return mockDeep<admin.firestore.Firestore>();
}

// ─── Auth Builder ─────────────────────────────────────────────────────────────

export function createMockAuth(): MockAuth {
  return mockDeep<admin.auth.Auth>();
}

// ─── DocumentReference Builder ────────────────────────────────────────────────

export function createMockDocumentRef(id = 'mock-doc-id'): MockDocumentReference {
  const ref = mockDeep<admin.firestore.DocumentReference>();
  Object.defineProperty(ref, 'id', { value: id, configurable: true });
  return ref;
}

// ─── DocumentSnapshot Builders ────────────────────────────────────────────────
// Usamos plain objects porque .exists es una propiedad booleana en Firestore real,
// NO una función. mockDeep la convertiría en función, rompiendo `if (doc.exists)`.

export function createMockDocSnapshot(id: string, data: Record<string, any>): any {
  return {
    exists: true,
    id,
    data: jest.fn().mockReturnValue(data),
    get: jest.fn((field: string) => data[field]),
  };
}

export function createMissingDocSnapshot(): any {
  return {
    exists: false,
    id: 'missing',
    data: jest.fn().mockReturnValue(undefined),
  };
}

// ─── WriteBatch Builder ───────────────────────────────────────────────────────

export function createMockWriteBatch(): MockWriteBatch {
  const batch = mockDeep<admin.firestore.WriteBatch>();
  batch.set.mockReturnValue(batch);
  batch.update.mockReturnValue(batch);
  batch.delete.mockReturnValue(batch);
  batch.commit.mockResolvedValue(undefined as any);
  return batch;
}

// ─── Transaction Builder ──────────────────────────────────────────────────────

export function createMockTransaction(): MockTransaction {
  const t = mockDeep<admin.firestore.Transaction>();
  t.set.mockReturnValue(t);
  t.update.mockReturnValue(t);
  return t;
}

// ─── QuerySnapshot Builders ───────────────────────────────────────────────────
// Usamos plain objects porque .empty y .docs son propiedades en Firestore real.

export function createEmptyQuerySnapshot(): any {
  return {
    empty: true,
    docs: [],
    size: 0,
    forEach: jest.fn(),
  };
}

export function createQuerySnapshot(docs: Array<{ id: string; data: Record<string, any> }>): any {
  const mockDocs = docs.map(({ id, data }) => createMockDocSnapshot(id, data));
  return {
    empty: docs.length === 0,
    docs: mockDocs,
    size: docs.length,
    forEach: jest.fn((fn: (doc: any) => void) => mockDocs.forEach(fn)),
  };
}

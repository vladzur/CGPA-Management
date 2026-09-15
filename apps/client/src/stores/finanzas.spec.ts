import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

/**
 * Callbacks que el store registra en cada onSnapshot, en el mismo orden en que
 * se suscribe: 0 = configuración/cuenta, 1 = proyectos, 2 = transacciones.
 */
const snapshotCallbacks: Array<(snapshot: any) => void> = [];
const unsubscribe = vi.fn();

vi.mock('../firebase', () => ({
  db: { mocked: true },
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'liceo_agb' })),
  collection: vi.fn(() => ({ id: 'collection' })),
  query: vi.fn((reference: unknown) => reference),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  onSnapshot: vi.fn((_reference: unknown, callback: (snapshot: any) => void) => {
    snapshotCallbacks.push(callback);
    return unsubscribe;
  }),
}));

import { useFinanzasStore } from './finanzas';

const INSTITUTION_DATA = {
  nombre: 'Centro General de Padres AGB',
  periodo_actual: '2026',
  saldo_total: 1250000,
  ultima_actualizacion: new Date('2026-08-01T10:00:00Z'),
};

function existingSnapshot(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

function missingSnapshot() {
  return { exists: () => false, data: () => undefined };
}

function collectionSnapshot(documents: Array<{ id: string; data: unknown }>) {
  return {
    forEach: (callback: (document: any) => void) =>
      documents.forEach((document) =>
        callback({ id: document.id, data: () => document.data }),
      ),
    docs: documents,
  };
}

describe('finanzas store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    snapshotCallbacks.length = 0;
    vi.clearAllMocks();
  });

  it('should start without institution data and with the loading indicator on', () => {
    const store = useFinanzasStore();

    expect(store.institucion).toBeNull();
    expect(store.loading).toBe(true);
  });

  it('should keep the loading indicator on until the first snapshot arrives', () => {
    const store = useFinanzasStore();
    store.init();

    expect(store.loading).toBe(true);
  });

  it('should store the institution document and turn the loading indicator off', () => {
    const store = useFinanzasStore();
    store.init();

    snapshotCallbacks[0](existingSnapshot(INSTITUTION_DATA));

    expect(store.loading).toBe(false);
    expect(store.institucion).toMatchObject({
      saldo_total: 1250000,
      periodo_actual: '2026',
    });
  });

  it('should turn the loading indicator off even when the document is missing', () => {
    const store = useFinanzasStore();
    store.init();

    snapshotCallbacks[0](missingSnapshot());

    expect(store.loading).toBe(false);
    expect(store.institucion).toBeNull();
  });

  it('should not reactivate the loading indicator when the store already holds data', () => {
    // Al volver a una página dentro de la SPA el store conserva los datos, así que
    // reactivar el indicador produciría un parpadeo innecesario.
    const store = useFinanzasStore();
    store.init();
    snapshotCallbacks[0](existingSnapshot(INSTITUTION_DATA));
    expect(store.loading).toBe(false);

    store.init();

    expect(store.loading).toBe(false);
    expect(store.institucion).not.toBeNull();
  });

  it('should map the projects collection into the store', () => {
    const store = useFinanzasStore();
    store.init();

    snapshotCallbacks[1](
      collectionSnapshot([{ id: 'p1', data: { nombre: 'Patio techado' } }]),
    );

    expect(store.proyectos).toEqual([{ id: 'p1', nombre: 'Patio techado' }]);
  });

  it('should map the transactions collection into the store', () => {
    const store = useFinanzasStore();
    store.init();

    snapshotCallbacks[2](
      collectionSnapshot([{ id: 't1', data: { tipo: 'INGRESO', monto: 500000 } }]),
    );

    expect(store.transacciones).toEqual([
      { id: 't1', tipo: 'INGRESO', monto: 500000 },
    ]);
  });

  it('should react to later snapshots so the balance stays up to date', () => {
    const store = useFinanzasStore();
    store.init();

    snapshotCallbacks[0](existingSnapshot(INSTITUTION_DATA));
    snapshotCallbacks[0](
      existingSnapshot({ ...INSTITUTION_DATA, saldo_total: 750000 }),
    );

    expect(store.institucion?.saldo_total).toBe(750000);
  });

  it('should unlink every listener on cleanup', () => {
    const store = useFinanzasStore();
    store.init();

    store.cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(3);
  });
});

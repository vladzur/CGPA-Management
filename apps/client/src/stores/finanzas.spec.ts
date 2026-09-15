import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('hydrate', () => {
    const INITIAL_STATE = {
      institucion: {
        nombre: 'Centro General de Padres AGB',
        periodo_actual: '2026',
        saldo_total: 1250000,
        ultima_actualizacion: '2026-08-01T10:00:00.000Z',
      },
      proyectos: [{ id: 'p1', nombre: 'Patio techado' }],
      transacciones: [{ id: 't1', tipo: 'INGRESO', monto: 500000 }],
    };

    it('should seed the store with the state embedded in the prerendered html', () => {
      const store = useFinanzasStore();

      store.hydrate(INITIAL_STATE);

      expect(store.institucion?.saldo_total).toBe(1250000);
      expect(store.proyectos).toHaveLength(1);
      expect(store.transacciones).toHaveLength(1);
    });

    it('should turn the loading indicator off when the balance was embedded', () => {
      const store = useFinanzasStore();
      expect(store.loading).toBe(true);

      store.hydrate(INITIAL_STATE);

      expect(store.loading).toBe(false);
    });

    it('should keep the loading indicator on when no balance was embedded', () => {
      const store = useFinanzasStore();

      store.hydrate({ institucion: null, proyectos: [], transacciones: [] });

      expect(store.loading).toBe(true);
    });

    it('should not bring the loading indicator back on the first init', () => {
      // Secuencia real al abrir una página prerenderizada: hidratar y luego montar.
      const store = useFinanzasStore();
      store.hydrate(INITIAL_STATE);

      store.init();

      expect(store.loading).toBe(false);
      expect(store.institucion?.saldo_total).toBe(1250000);
    });
  });

  describe('prerender state', () => {
    afterEach(() => {
      delete (window as any).__PRERENDER__;
      delete (window as any).__PRERENDER_STATE__;
    });

    it('should publish the resolved state with dates serialized as ISO strings', () => {
      (window as any).__PRERENDER__ = true;

      const store = useFinanzasStore();
      store.init();
      snapshotCallbacks[0](existingSnapshot(INSTITUTION_DATA));

      const published = (window as any).__PRERENDER_STATE__;

      expect(published.institucion.saldo_total).toBe(1250000);
      expect(published.institucion.ultima_actualizacion).toBe(
        INSTITUTION_DATA.ultima_actualizacion.toISOString(),
      );
      expect(published.proyectos).toEqual([]);
      expect(published.transacciones).toEqual([]);
    });

    it('should survive a JSON round trip so the prerender can embed it', () => {
      (window as any).__PRERENDER__ = true;

      const store = useFinanzasStore();
      store.init();
      snapshotCallbacks[0](existingSnapshot(INSTITUTION_DATA));
      snapshotCallbacks[2](
        collectionSnapshot([
          { id: 't1', data: { tipo: 'INGRESO', monto: 500000, fecha: new Date('2026-08-01T10:00:00Z') } },
        ]),
      );

      const restored = JSON.parse(
        JSON.stringify((window as any).__PRERENDER_STATE__),
      );

      expect(restored.institucion.saldo_total).toBe(1250000);
      expect(restored.transacciones[0].fecha).toBe('2026-08-01T10:00:00.000Z');
    });
  });
});

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { doc, onSnapshot, collection, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { publishPrerenderState } from '../utils/prerender';
import type { Institucion, Proyecto, Transaccion } from '@cgpa/shared';

/**
 * Cantidad de movimientos que se cargan por página en el historial del store.
 * Se usa tanto para la primera página como para cada carga bajo demanda.
 */
export const TRANSACTIONS_PAGE_SIZE = 15;

/**
 * Estado del store tal como se graba en el HTML estático.
 * Las fechas viajan como cadenas ISO porque un Timestamp de Firestore no
 * sobrevive a `JSON.stringify`.
 */
export interface FinanzasInitialState {
  institucion: Record<string, unknown> | null;
  proyectos: Record<string, unknown>[];
  transacciones: Record<string, unknown>[];
}

/** Convierte un timestamp de Firestore a una cadena ISO, si corresponde. */
function toIsoString(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return value;
}

export const useFinanzasStore = defineStore('finanzas', () => {
  const institucion = ref<Institucion | null>(null);
  const proyectos = ref<(Proyecto & { id: string })[]>([]);
  const transacciones = ref<(Transaccion & { id: string })[]>([]);
  const loading = ref(true);
  // Controla la carga bajo demanda del historial: cuántos movimientos se piden
  // en la ventana visible, si quedan documentos antiguos y si hay una petición
  // en curso.
  const hasMoreTransactions = ref(false);
  const loadingMoreTransactions = ref(false);
  const transactionsPageSize = ref(TRANSACTIONS_PAGE_SIZE);

  let unsubscribeInst: () => void;
  let unsubscribeProy: () => void;
  let unsubscribeTrans: () => void;

  /** Publica el estado ya resuelto para que el prerender lo grabe en el HTML. */
  function publishState(): void {
    publishPrerenderState({
      institucion: institucion.value
        ? {
            ...institucion.value,
            ultima_actualizacion: toIsoString(
              institucion.value.ultima_actualizacion,
            ),
          }
        : null,
      proyectos: proyectos.value.map((proyecto) => ({
        ...proyecto,
        fecha_inicio: toIsoString(proyecto.fecha_inicio),
      })),
      transacciones: transacciones.value.map((transaccion) => ({
        ...transaccion,
        fecha: toIsoString(transaccion.fecha),
      })),
    });
  }

  /**
   * Siembra el store con el estado que el HTML prerenderizado dejó disponible.
   * Se ejecuta antes del montaje, así que la primera pintura ya muestra el mismo
   * saldo y los mismos movimientos que el contenido estático.
   */
  function hydrate(state: FinanzasInitialState): void {
    if (state.institucion) {
      institucion.value = state.institucion as unknown as Institucion;
      // El saldo ya venía en el HTML: no corresponde mostrar el indicador de carga
      // mientras se resuelve el primer snapshot.
      loading.value = false;
    }

    if (Array.isArray(state.proyectos)) {
      proyectos.value = state.proyectos as unknown as (Proyecto & {
        id: string;
      })[];
    }

    if (Array.isArray(state.transacciones)) {
      transacciones.value = state.transacciones as unknown as (Transaccion & {
        id: string;
      })[];
    }
  }

  function init() {
    // El indicador de carga solo se activa si todavía no hay datos. Cuando la
    // página llega prerenderizada con el saldo ya visible, reactivarlo provocaría
    // el parpadeo "número → spinner → número" al montar la aplicación.
    if (!institucion.value) {
      loading.value = true;
    }

    const instRef = doc(db, 'configuracion', 'liceo_agb');
    unsubscribeInst = onSnapshot(instRef, (snapshot) => {
      if (snapshot.exists()) {
        institucion.value = snapshot.data() as Institucion;
      }
      loading.value = false;
      publishState();
    });

    const proyRef = collection(db, 'proyectos');
    const q = query(proyRef, orderBy('fecha_inicio', 'desc'), limit(50));
    unsubscribeProy = onSnapshot(q, (snapshot) => {
      const data: (Proyecto & { id: string })[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as any);
      });
      proyectos.value = data;
      publishState();
    });
    subscribeTransactions();
  }

  /**
   * Abre el listener en tiempo real del historial de movimientos con la ventana
   * visible actual. Al ampliar `transactionsPageSize` se vuelve a suscribir para
   * traer los documentos siguientes.
   */
  function subscribeTransactions(): void {
    const transRef = collection(db, 'transacciones');
    const qTrans = query(
      transRef,
      orderBy('fecha', 'desc'),
      limit(transactionsPageSize.value),
    );
    unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const data: (Transaccion & { id: string })[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as any);
      });
      transacciones.value = data;
      // Si Firestore devolvió menos documentos que la página solicitada, ya no
      // quedan movimientos antiguos por cargar.
      hasMoreTransactions.value = data.length >= transactionsPageSize.value;
      loadingMoreTransactions.value = false;
      publishState();
    });
  }

  /**
   * Amplía en una página la ventana visible del historial y vuelve a suscribir
   * el listener para mantener la actualización en tiempo real.
   */
  function loadMoreTransactions(): void {
    if (loadingMoreTransactions.value || !hasMoreTransactions.value) return;

    loadingMoreTransactions.value = true;
    transactionsPageSize.value += TRANSACTIONS_PAGE_SIZE;

    // Se libera el listener anterior antes de pedir la ventana ampliada.
    if (unsubscribeTrans) unsubscribeTrans();
    subscribeTransactions();
  }

  function cleanup() {
    if (unsubscribeInst) unsubscribeInst();
    if (unsubscribeProy) unsubscribeProy();
    if (unsubscribeTrans) unsubscribeTrans();
  }

  return {
    institucion,
    proyectos,
    transacciones,
    loading,
    hasMoreTransactions,
    loadingMoreTransactions,
    loadMoreTransactions,
    init,
    cleanup,
    hydrate,
  };
});

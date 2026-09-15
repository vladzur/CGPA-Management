import { defineStore } from 'pinia';
import { ref } from 'vue';
import { doc, onSnapshot, collection, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { publishPrerenderState } from '../utils/prerender';
import type { Institucion, Proyecto, Transaccion } from '@cgpa/shared';

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
    const transRef = collection(db, 'transacciones');
    const qTrans = query(transRef, orderBy('fecha', 'desc'), limit(15));
    unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const data: (Transaccion & { id: string })[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as any);
      });
      transacciones.value = data;
      publishState();
    });
  }

  function cleanup() {
    if (unsubscribeInst) unsubscribeInst();
    if (unsubscribeProy) unsubscribeProy();
    if (unsubscribeTrans) unsubscribeTrans();
  }

  return { institucion, proyectos, transacciones, loading, init, cleanup, hydrate };
});

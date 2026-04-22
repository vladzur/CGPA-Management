import { defineStore } from 'pinia';
import { ref } from 'vue';
import { doc, onSnapshot, collection, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Institucion, Proyecto, Transaccion } from '@cgpa/shared';

export const useFinanzasStore = defineStore('finanzas', () => {
  const institucion = ref<Institucion | null>(null);
  const proyectos = ref<(Proyecto & { id: string })[]>([]);
  const transacciones = ref<(Transaccion & { id: string })[]>([]);
  const loading = ref(true);
  
  let unsubscribeInst: () => void;
  let unsubscribeProy: () => void;
  let unsubscribeTrans: () => void;

  function init() {
    loading.value = true;
    
    const instRef = doc(db, 'configuracion', 'liceo_agb');
    unsubscribeInst = onSnapshot(instRef, (snapshot) => {
      if (snapshot.exists()) {
        institucion.value = snapshot.data() as Institucion;
      }
      loading.value = false;
    });

    const proyRef = collection(db, 'proyectos');
    const q = query(proyRef, orderBy('fecha_inicio', 'desc'), limit(5));
    unsubscribeProy = onSnapshot(q, (snapshot) => {
      const data: (Proyecto & { id: string })[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as any);
      });
      proyectos.value = data;
    });
    const transRef = collection(db, 'transacciones');
    const qTrans = query(transRef, orderBy('fecha', 'desc'), limit(15));
    unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const data: (Transaccion & { id: string })[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as any);
      });
      transacciones.value = data;
    });
  }

  function cleanup() {
    if (unsubscribeInst) unsubscribeInst();
    if (unsubscribeProy) unsubscribeProy();
    if (unsubscribeTrans) unsubscribeTrans();
  }

  return { institucion, proyectos, transacciones, loading, init, cleanup };
});

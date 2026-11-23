/**
 * @file firestore.rules.spec.ts
 * @description Verifica las reglas de Firestore contra el emulador.
 *
 * El sitio lee la transparencia por la API, pero `proyectos`, `transacciones`,
 * `configuracion` y `respaldos_publicos` conservan lectura pública directa.
 * `documentos` y `comunicados` (con borradores y `salt`) dejan de ser legibles.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const rules = readFileSync(
  path.resolve(__dirname, '../../../../firestore.rules'),
  'utf8',
);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-cgpa-rules',
    firestore: { rules },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'documentos', 'doc-1'), {
      titulo: 'Documento privado',
      salt: 'secreto',
    });
    await setDoc(doc(db, 'comunicados', 'com-1'), {
      titulo: 'Borrador',
      estado: 'BORRADOR',
    });
    await setDoc(doc(db, 'proyectos', 'proy-1'), {
      nombre: 'Proyecto público',
    });
    await setDoc(doc(db, 'transacciones', 'txn-1'), {
      monto: 1000,
    });
    await setDoc(doc(db, 'respaldos_publicos', 'txn-1'), {
      url: 'https://example.test/redactado.pdf',
    });
    await setDoc(doc(db, 'pagos_notificaciones', 'notif-1'), {
      proveedor: 'khipu',
    });
    await setDoc(doc(db, 'mensajes', 'msg-1'), {
      nombre: 'Apoderado',
    });
    await setDoc(doc(db, 'configuracion', 'liceo_agb'), {
      saldo_total: 0,
    });
  });
});

describe('lecturas públicas', () => {
  it('debe denegar la lectura anónima de documentos y comunicados', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, 'documentos', 'doc-1')));
    await assertFails(getDoc(doc(db, 'comunicados', 'com-1')));
  });

  it('debe permitir la lectura pública de transparencia', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(db, 'proyectos', 'proy-1')));
    await assertSucceeds(getDoc(doc(db, 'transacciones', 'txn-1')));
    await assertSucceeds(getDoc(doc(db, 'respaldos_publicos', 'txn-1')));
    await assertSucceeds(getDoc(doc(db, 'configuracion', 'liceo_agb')));
  });

  it('debe denegar pagos, notificaciones y mensajes a un anónimo', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, 'pagos_notificaciones', 'notif-1')));
    await assertFails(getDoc(doc(db, 'mensajes', 'msg-1')));
  });
});

describe('escrituras', () => {
  it('debe denegar la escritura anónima, incluso en colecciones públicas', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(db, 'respaldos_publicos', 'txn-2'), {
        url: 'https://example.test/falso.pdf',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'proyectos', 'proy-2'), { nombre: 'Falso' }),
    );
    await assertFails(setDoc(doc(db, 'transacciones', 'txn-2'), { monto: 1 }));
  });
});

describe('mensajes', () => {
  it('debe permitir la lectura a un ADMIN activo', async () => {
    const db = testEnv
      .authenticatedContext('admin-1', { role: 'ADMIN', activo: true })
      .firestore();

    await assertSucceeds(getDoc(doc(db, 'mensajes', 'msg-1')));
  });

  it('debe denegar la lectura a un usuario inactivo o con otro rol', async () => {
    const inactive = testEnv
      .authenticatedContext('admin-inactivo', { role: 'ADMIN', activo: false })
      .firestore();
    const apoderado = testEnv
      .authenticatedContext('apoderado-1', {
        role: 'APODERADO',
        activo: true,
      })
      .firestore();

    await assertFails(getDoc(doc(inactive, 'mensajes', 'msg-1')));
    await assertFails(getDoc(doc(apoderado, 'mensajes', 'msg-1')));
  });
});

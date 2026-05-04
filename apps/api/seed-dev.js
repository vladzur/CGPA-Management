const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const PROJECT_ID = 'demo-cgpa-platform';
const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = 'admin@cgpa.cl';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Administrador CGPA';

async function seed() {
  console.log('Seeding local emulators...');
  console.log(`  Project ID: ${PROJECT_ID}`);
  console.log(`  Auth:       ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`  Firestore:  ${process.env.FIRESTORE_EMULATOR_HOST}\n`);

  // ── 1. Crear usuario admin en Auth Emulator ─────────────────────────────
  console.log('[1/5] Creando usuario admin en Auth Emulator...');
  let userRecord;

  // Eliminar si existe para evitar estado inconsistente
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`  Usuario existente encontrado (${existing.uid}), recreando...`);
    await auth.deleteUser(existing.uid);
  } catch {
    // No existe, ok
  }

  userRecord = await auth.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    displayName: ADMIN_NAME,
  });
  console.log(`  Usuario creado: ${userRecord.uid}`);

  // Verificar que se creo
  const fetched = await auth.getUser(userRecord.uid);
  if (fetched.email !== ADMIN_EMAIL) {
    throw new Error('Fallo la verificacion: el usuario no se creo correctamente');
  }
  console.log('  Verificado: el usuario existe en el Auth Emulator');

  // ── 2. Setear custom claims ─────────────────────────────────────────────
  console.log('[2/5] Configurando rol ADMIN...');
  await auth.setCustomUserClaims(userRecord.uid, {
    role: 'ADMIN',
    activo: true,
  });

  // Verificar claims
  const userWithClaims = await auth.getUser(userRecord.uid);
  if (userWithClaims.customClaims?.role !== 'ADMIN') {
    throw new Error('Fallo la verificacion: los custom claims no se asignaron');
  }
  console.log('  Custom claims verificados: { role: ADMIN, activo: true }');

  // ── 3. Crear documento en Firestore ─────────────────────────────────────
  console.log('[3/5] Creando documento en usuarios...');
  await db.collection('usuarios').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    activo: true,
    rol: 'ADMIN',
    fecha_registro: Timestamp.now(),
    fecha_aprobacion: Timestamp.now(),
    aprobado_por: userRecord.uid,
  });

  // Verificar doc en Firestore
  const userDoc = await db.collection('usuarios').doc(userRecord.uid).get();
  if (!userDoc.exists) {
    throw new Error('Fallo la verificacion: el documento de usuario no se creo');
  }
  console.log('  Documento verificado en Firestore');

  // ── 4. Seed de datos base ───────────────────────────────────────────────
  console.log('[4/5] Insertando datos de prueba...');

  await db.collection('configuracion').doc('liceo_agb').set({
    nombre: 'Centro General de Padres AGB',
    periodo_actual: '2026',
    saldo_total: 15450000,
    ultima_actualizacion: Timestamp.now(),
  });

  await db.collection('proyectos').doc('proy-1').set({
    nombre: 'Techado Cancha Principal',
    descripcion: 'Instalacion de estructura metalica y techo para proteger a los alumnos del clima.',
    estado: 'EN_CURSO',
    presupuesto_estimado: 5000000,
    monto_recaudado: 5000000,
    monto_ejecutado: 3200000,
    fecha_inicio: Timestamp.now(),
    responsable: { uid: userRecord.uid, nombre: ADMIN_NAME },
  });

  // ── 5. Comunicado de prueba ─────────────────────────────────────────────
  console.log('[5/5] Creando comunicado de prueba...');
  await db.collection('comunicados').add({
    titulo: 'Bienvenidos al nuevo sistema de comunicados',
    contenido: `# Bienvenidos

Este es el nuevo sistema de **comunicados oficiales** del CGPA.

## Que encontraran aqui

- Informacion sobre proyectos en curso
- Fechas importantes y eventos
- Resumenes financieros
- Avisos de la directiva

## Contacto

Para consultas, contactar a la directiva via los canales oficiales.

---
*Este es un comunicado de prueba generado por el seeder.*`,
    estado: 'PUBLICADO',
    fecha_publicacion: Timestamp.now(),
    fecha_creacion: Timestamp.now(),
    creado_por: { uid: userRecord.uid, nombre: ADMIN_NAME },
  });

  console.log('\nTodos los pasos completados y verificados.');
  console.log('──────────────────────────────────────────────');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('──────────────────────────────────────────────');
  console.log('Ahora puedes iniciar sesion en /login');
  process.exit(0);
}

seed().catch((err) => {
  console.error('\nERROR en el seed:', err.message);
  console.error('Asegurate de que los emuladores esten corriendo:');
  console.error('  firebase emulators:start');
  process.exit(1);
});

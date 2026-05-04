const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const app = initializeApp({ projectId: 'demo-cgpa-platform' });
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = 'admin@cgpa.cl';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Administrador CGPA';

async function seed() {
  console.log('Seeding local emulators...\n');

  // ── 1. Crear usuario admin en Auth Emulator ─────────────────────────────
  console.log('[1/4] Creando usuario admin en Auth Emulator...');
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`  Usuario ya existe: ${userRecord.uid}`);
  } catch {
    userRecord = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
    });
    console.log(`  Usuario creado: ${userRecord.uid}`);
  }

  // ── 2. Setear custom claims ─────────────────────────────────────────────
  console.log('[2/4] Configurando rol ADMIN...');
  await auth.setCustomUserClaims(userRecord.uid, {
    role: 'ADMIN',
    activo: true,
  });
  console.log('  Custom claims asignados: { role: ADMIN, activo: true }');

  // ── 3. Crear documento en Firestore ─────────────────────────────────────
  console.log('[3/4] Creando documento en usuarios...');
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
  console.log('  Documento creado en usuarios/{uid}');

  // ── 4. Seed de datos base ───────────────────────────────────────────────
  console.log('[4/4] Insertando datos de prueba...');

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

  console.log('\nSeed completado exitosamente!');
  console.log('──────────────────────────────────────────────');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('──────────────────────────────────────────────');
  console.log('Ahora puedes iniciar sesion en /login');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en el seed:', err);
  process.exit(1);
});

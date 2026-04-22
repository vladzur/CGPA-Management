const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const app = initializeApp({ projectId: 'demo-cgpa-platform' });
const db = getFirestore(app);

async function seed() {
  console.log('Seeding Firestore Emulator...');
  
  await db.collection('configuracion').doc('liceo_agb').set({
    nombre: 'Centro General de Padres AGB',
    periodo_actual: '2026',
    saldo_total: 15450000,
    ultima_actualizacion: Timestamp.now()
  });

  await db.collection('proyectos').doc('proy-1').set({
    nombre: 'Techado Cancha Principal',
    descripcion: 'Instalación de estructura metálica y techo para proteger a los alumnos del clima.',
    estado: 'EN_CURSO',
    presupuesto_estimado: 5000000,
    monto_recaudado: 5000000,
    monto_ejecutado: 3200000,
    fecha_inicio: Timestamp.now(),
    responsable: { uid: 'user1', nombre: 'Carlos Ruiz' }
  });

  await db.collection('proyectos').doc('proy-2').set({
    nombre: 'Renovación Biblioteca',
    descripcion: 'Compra de nuevo mobiliario, estanterías y libros actualizados.',
    estado: 'PLANIFICACION',
    presupuesto_estimado: 1200000,
    monto_recaudado: 800000,
    monto_ejecutado: 0,
    fecha_inicio: Timestamp.now(),
    responsable: { uid: 'user2', nombre: 'Ana Torres' }
  });

  console.log('Data seeded successfully!');
  process.exit(0);
}

seed().catch(console.error);

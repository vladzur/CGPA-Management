const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// En produccion, Firebase Admin se autoconfigura con Application Default Credentials
const app = initializeApp();
const db = getFirestore(app);

async function migrate() {
  console.log('Conectando a Firestore (produccion)...');

  const docRef = db.collection('configuracion').doc('liceo_agb');
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    console.log('El documento configuracion/liceo_agb ya existe. No se requiere migracion.');
    console.log('Datos actuales:', docSnap.data());
  } else {
    await docRef.set({
      nombre: 'Centro General de Padres AGB',
      periodo_actual: '2026',
      saldo_total: 0,
      ultima_actualizacion: Timestamp.now(),
    });
    console.log('Documento configuracion/liceo_agb creado exitosamente.');
  }

  process.exit(0);
}

migrate().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

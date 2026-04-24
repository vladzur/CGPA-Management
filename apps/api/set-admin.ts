import * as admin from 'firebase-admin';

// Reemplaza con tu correo
const email = process.argv[2];

if (!email) {
  console.error('Por favor provee un correo como argumento.');
  console.error('Ejemplo: npx ts-node set-admin.ts admin@ejemplo.com');
  process.exit(1);
}

// Inicializar la app de Firebase.
// Asegúrate de tener GOOGLE_APPLICATION_CREDENTIALS configurado
// o usar este script en el entorno donde ya tienes acceso al proyecto de Firebase.
admin.initializeApp();

async function setAdminClaim() {
  try {
    console.log(`Buscando usuario con correo: ${email}`);
    const user = await admin.auth().getUserByEmail(email);
    
    console.log(`Usuario encontrado: ${user.uid}. Asignando roles...`);
    await admin.auth().setCustomUserClaims(user.uid, {
      role: 'ADMIN',
      activo: true,
    });
    
    console.log('✅ Roles asignados exitosamente en Firebase Auth.');
    console.log('Ahora puedes iniciar sesión.');
  } catch (error) {
    console.error('❌ Error asignando roles:', error);
  } finally {
    process.exit(0);
  }
}

setAdminClaim();

/**
 * Retorna el timestamp actual como Date, compatible con los esquemas Zod.
 * Firestore lo convierte automáticamente a Timestamp al escribir.
 */
export function firestoreNow(): Date {
  return new Date();
}

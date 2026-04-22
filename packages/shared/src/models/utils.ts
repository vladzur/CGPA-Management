import { z } from 'zod';

export const TimestampSchema = z.preprocess((val) => {
  if (typeof val === 'string') return new Date(val); // Desde JSON
  if (val && typeof (val as any).toDate === 'function') return (val as any).toDate(); // Desde Firestore
  return val; // Pasa directo si ya es Date
}, z.date({ message: "Debe ser una fecha válida (Date, Timestamp o string ISO)" }));

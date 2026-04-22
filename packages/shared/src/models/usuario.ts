import { z } from 'zod';

export const RolUsuarioSchema = z.enum(['ADMIN', 'TESORERO', 'APODERADO']);

export const UsuarioSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  rol: RolUsuarioSchema,
  activo: z.boolean(),
});

export type RolUsuario = z.infer<typeof RolUsuarioSchema>;
export type Usuario = z.infer<typeof UsuarioSchema>;

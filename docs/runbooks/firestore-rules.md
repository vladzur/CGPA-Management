# Runbook: reglas de Firestore y Storage

## Principio

Las reglas de Firebase se cambian **solo por Pull Request**. La consola de
Firebase es de solo lectura para el equipo: un cambio manual no queda auditado y
hace que producción diverga del repositorio.

## Flujo de cambio

1. Modificar `firestore.rules` o `storage.rules` en una rama.
2. Actualizar o agregar casos en `apps/api/test/rules/` y ejecutar:

   ```bash
   pnpm --filter @cgpa/api test:rules
   ```

   El comando levanta el emulador de Firestore, aplica las reglas del repositorio
   y ejecuta los casos permitidos y denegados.
3. Abrir el PR. El workflow de PR ejecuta el job `Firestore Rules Tests` con
   Temurin 17.
4. Mergear a `master`. El release (tag `v*.*.*`) ejecuta:
   - `test`
   - `rules` (pruebas contra el emulador)
   - `deploy_rules` (`firebase deploy --only firestore:rules,storage`)
5. Verificar en la consola que la versión desplegada coincide con el commit.

## Colecciones y visibilidad

| Colección | Lectura pública | Escritura | Motivo |
|---|---|---|---|
| `configuracion` | Sí | No | Transparencia del saldo global. |
| `proyectos` | Sí | No | Transparencia de proyectos. |
| `transacciones` | Sí | No | Historial financiero append-only. |
| `respaldos_publicos` | Sí | No | Copias redactadas aprobadas por la directiva. |
| `documentos` | **No** | No | La API entrega el DTO mínimo por QR. |
| `comunicados` | **No** | No | Incluye borradores; el sitio usa `/api/comunicados/publicos`. |
| `pagos` | No | No | Contiene datos personales. |
| `pagos_notificaciones` | No | No | Diagnóstico interno del webhook. |
| `pagos_errores` | No | No | Diagnóstico interno de pasarelas. |
| `usuarios` | Solo ADMIN | No | Datos de cuentas. |
| `mensajes` | Solo ADMIN activo | No | Datos personales de apoderados. |
| `auditoria` | Solo ADMIN | No | Trazabilidad. |

## Rollback

Si una regla rompe una integración:

1. Identificar el commit anterior que modificó las reglas.
2. Revertir el PR o desplegar desde ese commit:

   ```bash
   git revert <sha>
   ```

3. El release vuelve a desplegar las reglas del repositorio. No se edita la
   consola para "arreglar" producción.

## Verificación manual

```bash
firebase emulators:start --only firestore --project demo-cgpa-rules
pnpm --filter @cgpa/api test:rules
firebase hosting:channel:list --project cgpa-liceo-agb
```

Nunca se ejecutan comandos contra producción sin una ventana acordada.

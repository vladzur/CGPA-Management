# Prueba Funcional — Sandbox de Khipu

> **Objetivo:** validar el flujo de pago completo contra el entorno de integración de Khipu
> **antes** de publicar en `master`, sin mover dinero real y sin ensuciar los datos del CGPA.
>
> Contexto técnico: [integracion-pasarelas-pago.md](integracion-pasarelas-pago.md).
> Especificación del proveedor: [boton_de_pago.md](boton_de_pago.md).

---

## 1. Qué valida esta prueba

| # | Comportamiento | Dónde se observa |
|---|---|---|
| 1 | Alta del cobro en Khipu con el monto y el pagador correctos | Log `Cobro khipu creado transaction_id=…` |
| 2 | Redirección al portal de pago | Navegador, portal de Khipu |
| 3 | Recepción del webhook | Log del endpoint `POST /api/pagos/khipu/webhook` |
| 4 | Verificación servidor a servidor (no se confía en el body) | Estado pasa a `PAGADO` solo tras consultar la API |
| 5 | Idempotencia ante notificaciones repetidas | Log `actualizado: false` en la segunda notificación |
| 6 | Retorno a `/pagar/confirmacion` con el estado correcto | Página de estado del pago |
| 7 | Cancelación | Página `/pagar/cancelado` |
| 8 | Aislamiento de datos | Los registros quedan en `pagos_sandbox` |

### Por qué no se puede hacer desde el preview del PR

El workflow [firebase-hosting-pull-request.yml](../.github/workflows/firebase-hosting-pull-request.yml)
despliega **solo el frontend** en un canal de preview, y el rewrite `/api/**` de
[firebase.json](../firebase.json) apunta al servicio Cloud Run de **producción**. Un preview, por
tanto, ejecutaría el cobro con las credenciales reales. Por eso esta prueba se hace en local con un
túnel al backend.

---

## 2. Requisitos previos

- Node.js 24 y pnpm 11 (ver README).
- Firebase CLI y Java (para los emuladores).
- Credenciales de **integración** de Khipu, obtenidas en el portal de desarrolladores.
- Un túnel HTTPS hacia el puerto 3000. En los ejemplos se usa `ngrok`.

```bash
# Instalación del túnel (una sola vez)
# https://ngrok.com/download  → o bien:
sudo snap install ngrok
```

> Si Khipu indica un host distinto para integración, configúralo en `KHIPU_API_BASE_URL`.
> Si usa el mismo host que producción, basta con la clave de integración.

---

## 3. Configuración local

### 3.1 Variables de la API (`apps/api/.env`)

```dotenv
# Credenciales de INTEGRACIÓN (sandbox), no las de producción.
KHIPU_API_KEY="<clave-de-integracion>"
KHIPU_API_BASE_URL="https://khipu.com/api/v3"

# El webhook debe ser alcanzable desde internet: reemplaza por tu URL de ngrok.
PUBLIC_API_URL="https://<subdominio>.ngrok-free.app/api"

# El apoderado vuelve al frontend local.
CLIENT_BASE_URL="http://localhost:5173"

# Aislamiento: los cobros de prueba no aparecen en el historial real.
PAGOS_COLECCION="pagos_sandbox"

PAGO_TTL_DIAS="7"
```

> **Nunca** uses aquí la clave de producción. Si la prueba se ejecuta contra el proyecto Firebase
> real (modo producción), `PAGOS_COLECCION="pagos_sandbox"` garantiza que los registros queden fuera
> de la colección que consulta la directiva.

### 3.2 Variables del cliente (`apps/client/.env`)

```dotenv
VITE_API_URL="http://localhost:3000/api"
```

---

## 4. Puesta en marcha

En tres terminales, desde la raíz del repositorio:

```bash
# 1. Emuladores de Firebase (Firestore, Auth, Storage)
firebase emulators:start --project demo-cgpa-platform

# 2. Túnel HTTPS hacia el backend
ngrok http 3000
# Copia la URL https://<subdominio>.ngrok-free.app y actualiza PUBLIC_API_URL,
# luego reinicia la API para que tome el cambio.

# 3. Backend + frontend
pnpm run dev
```

Verifica que el backend esté accesible desde fuera antes de crear un cobro:

```bash
curl -i -X POST https://<subdominio>.ngrok-free.app/api/pagos/khipu/webhook \
  -H 'Content-Type: application/json' \
  -d '{}'
# Esperado: HTTP 200 con {"recibido":true,"estado":null}
```

Si devuelve 404, el rewrite o `PUBLIC_API_URL` están mal: Khipu nunca podrá notificar el pago.

---

## 5. Ejecución

1. Abre `http://localhost:5173/pagar`.
2. Completa nombre y correo reales (Khipu envía el comprobante), deja **Cuota anual 2027** y el
   monto `10000`.
3. Pulsa **Pagar con Khipu** y confirma que el navegador salta al portal de integración.
4. Paga con los datos de prueba que entrega el portal de Khipu.
5. Al volver, revisa `/pagar/confirmacion?transaction_id=…`:
   - `PAGADO` → flujo correcto (webhook verificado).
   - `PENDIENTE` durante unos segundos → la página reintenta cada 3 s; si persiste, revisa los logs.
6. En la terminal del backend deben aparecer, en este orden:

```
Cobro khipu creado transaction_id=CGPA-PAY-2026-… referencia=…
Cobro CGPA-PAY-2026-… actualizado: PENDIENTE → PAGADO
```

7. Comprueba el registro aislado en el emulador UI (<http://127.0.0.1:4000>) → Firestore →
   `pagos_sandbox`. También puedes consultarlo por REST (el namespace es el `projectId` que usa la
   API en desarrollo, `cgpa-liceo-agb`):

```bash
curl -s "http://127.0.0.1:8080/v1/projects/cgpa-liceo-agb/databases/(default)/documents/pagos_sandbox" \
  | head -40
```

La colección `pagos` (real) no debe tener documentos nuevos.

---

## 6. Casos adicionales recomendados

| Caso | Cómo provocarlo | Resultado esperado |
|---|---|---|
| Cancelación | Abandonar el portal de Khipu | Retorno a `/pagar/cancelado`; estado `CANCELADO` |
| Notificación duplicada | Reenviar el mismo POST del webhook | `200` sin cambios; log `actualizado: false` |
| Notificación sin token | `POST /pagos/khipu/webhook` con `{}` | `200` con `{recibido:true, estado:null}` |
| Monto alterado | Modificar `monto` en el documento de Firestore y reenviar el webhook | Log `Discrepancia en el pago`; el estado no cambia |
| Pasarela inexistente | `POST /api/pagos/webpay` | `400 Método de pago no soportado: webpay` |

---

## 7. Solución de problemas

| Síntoma | Causa | Acción |
|---|---|---|
| `503` al crear el cobro | `KHIPU_API_KEY` ausente en `apps/api/.env` | Reiniciar la API tras completarla |
| `502` al crear el cobro | Credencial inválida o host de sandbox distinto | Revisar la clave y `KHIPU_API_BASE_URL` |
| El pago queda `PENDIENTE` para siempre | El webhook no llega | Confirmar que `PUBLIC_API_URL` usa la URL de ngrok vigente y reiniciar la API |
| ngrok cambió de URL | El plan gratuito rota el subdominio | Actualizar `PUBLIC_API_URL` y reiniciar |
| El retorno va al sitio de producción | `CLIENT_BASE_URL` apunta al dominio real | Debe ser `http://localhost:5173` |
| Los cobros aparecen en el historial | Falta `PAGOS_COLECCION` | Definir `pagos_sandbox` y reiniciar |

---

## 8. Limpieza

```bash
# Borra los documentos de prueba del emulador (namespace usado por la API)
curl -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/cgpa-liceo-agb/databases/(default)/documents"
```

Si la prueba se hizo contra el proyecto real, elimina manualmente la colección `pagos_sandbox`
desde la consola de Firebase y restaura `PAGOS_COLECCION="pagos"`.

---

## 9. Paso a producción

No requiere cambios de código: el entorno se define por configuración.

| Variable | Sandbox | Producción |
|---|---|---|
| `KHIPU_API_KEY` | Clave de integración | Clave real de la cuenta del CGPA |
| `KHIPU_API_BASE_URL` | Host de integración (si difiere) | `https://khipu.com/api/v3` |
| `PUBLIC_API_URL` | Túnel de ngrok | `https://cgpagrahambell.cl/api` |
| `CLIENT_BASE_URL` | `http://localhost:5173` | `https://cgpagrahambell.cl` |
| `PAGOS_COLECCION` | `pagos_sandbox` | `pagos` |

Checklist antes de publicar:

- [ ] `KHIPU_API_KEY` de producción agregado como secreto de GitHub y desplegado en Cloud Run.
- [ ] `PAGOS_COLECCION` sin definir (o `pagos`) en el servicio de producción.
- [ ] Webhook accesible en `https://cgpagrahambell.cl/api/pagos/khipu/webhook`.
- [ ] Un pago real de bajo monto verificado de punta a punta y conciliado por la directiva.
- [ ] Comprobante de Khipu recibido en el correo del pagador.

---

## 10. Referencias

- [integracion-pasarelas-pago.md](integracion-pasarelas-pago.md) — arquitectura y contrato `PasarelaPago`.
- [boton_de_pago.md](boton_de_pago.md) — especificación de la API v3 de Khipu.
- [README](../README.md#-botón-de-pago) — variables de entorno y resumen del flujo.

# Pasarelas de Pago — Arquitectura e Integración

> **Objetivo:** documentar cómo está implementado el botón de pago del CGPA y el procedimiento
> completo para agregar una pasarela nueva (Webpay, Mercado Pago, Flow, etc.) sin tocar la lógica
> de negocio ni la contabilidad.
>
> **Implementación vigente:** Khipu (API v3). Especificación del proveedor:
> [boton_de_pago.md](boton_de_pago.md).

---

## 1. Principio de diseño

El sistema separa dos responsabilidades que cambian por motivos distintos:

| Responsabilidad | Dónde vive | Qué contiene |
|---|---|---|
| **Negocio del CGPA** | `PagosService` (orquestador) | Identificador interno, persistencia, idempotencia, validación de monto/moneda, transiciones de estado, consulta pública e historial |
| **Protocolo del proveedor** | Implementación de `PasarelaPago` | Payload, credenciales, URLs del proveedor, verificación servidor a servidor y traducción de estados |

Consecuencia práctica: agregar una pasarela **no** modifica el orquestador, las reglas de Firestore,
las páginas de confirmación/cancelación ni el modelo de datos.

```
┌──────────────┐   POST /api/pagos/:proveedor    ┌───────────────────┐
│  /pagar      │ ──────────────────────────────> │  PagosController  │
│  (Vue SPA)   │ <────────────────────────────── │                   │
└──────────────┘   { payment_url }               └─────────┬─────────┘
      │                                                    │
      │  redirect                                          ▼
      ▼                                          ┌───────────────────┐
┌──────────────┐                                 │   PagosService    │
│ Portal del   │                                 │  (orquestador)    │
│ proveedor    │                                 │                   │
└──────┬───────┘                                 │  · transaction_id │
       │  pago                                   │  · persistencia   │
       │                                         │  · idempotencia   │
       ▼                                         │  · estados        │
┌──────────────┐  POST /api/pagos/:p/webhook     └─────────┬─────────┘
│  Proveedor   │ ─────────────────────────────────────────>│
└──────────────┘                                          │
                                                          ▼
                                              ┌───────────────────────┐
                                              │ PasarelasService      │
                                              │  (resuelve por id)    │
                                              └───────────┬───────────┘
                                                          ▼
                                              ┌───────────────────────┐
                                              │ PasarelaPago          │
                                              │  └ KhipuPasarela      │
                                              │  └ (Webpay, …)        │
                                              └───────────┬───────────┘
                                                          │ verificación
                                                          ▼  servidor a servidor
                                                    API del proveedor
```

---

## 2. Componentes

### 2.1 Backend (`apps/api/src/pagos`)

| Archivo | Rol |
|---|---|
| `pagos.controller.ts` | Rutas HTTP públicas y de administración. |
| `pagos.service.ts` | Orquestador: crea cobros, aplica notificaciones, reconcilia y lista. |
| `dto/create-pago.dto.ts` | Validación Zod del formulario (concepto, monto, nombre, correo). |
| `pasarelas/pasarela-pago.interface.ts` | Contrato `PasarelaPago` y token `PASARELAS_PAGO`. |
| `pasarelas/pasarelas.service.ts` | Registro: resuelve una pasarela por identificador. |
| `pasarelas/khipu/khipu-pasarela.ts` | Implementación Khipu. |
| `pagos.module.ts` | Registra las pasarelas disponibles en el arreglo `PASARELAS_PAGO`. |

### 2.2 Modelo compartido (`packages/shared/src/models/pago.ts`)

Única fuente de verdad para la API y el cliente:

- `ProveedorPagoSchema` / `ProveedorPago`: pasarelas soportadas (`khipu`).
- `EstadoPagoSchema` / `EstadoPago`: `PENDIENTE`, `PAGADO`, `CANCELADO`, `FALLIDO`.
- `PagoSchema` / `Pago`: documento persistido.
- `ESTADO_PAGO_LABELS`, `PROVEEDOR_PAGO_LABELS`, `PROVEEDOR_PAGO_PREDETERMINADO`.
- `PAGO_MONTO_MINIMO` (100), `PAGO_MONTO_MAXIMO` (10.000.000).

### 2.3 Frontend (`apps/client/src`)

| Archivo | Rol |
|---|---|
| `views/Pagar.vue` | Formulario público; envía a `POST /pagos/:proveedor` y redirige a la URL devuelta. |
| `views/PagoConfirmacion.vue` | Retorno del apoderado: consulta `GET /pagos/:transactionId` cada 3 s (máx. 20 intentos) hasta un estado terminal. |
| `views/PagoCancelado.vue` | Retorno cuando el apoderado abandona el pago. |
| `utils/pago-form.ts` | Validación del formulario y armado del payload (independiente del proveedor). |
| `content/public-routes.ts` | Declara `/pagar`; los retornos quedan fuera del catálogo indexable. |

---

## 3. Modelo de datos

Colección de Firestore **`pagos`**, documento con id = `transaction_id`.

| Campo | Tipo | Descripción |
|---|---|---|
| `transaction_id` | string | Referencia interna `CGPA-PAY-<año>-<16 hex>`. Es el id del documento. |
| `proveedor` | `'khipu'` | Pasarela que procesó el cobro. |
| `referencia_externa` | string? | Id del cobro en el proveedor. |
| `token_notificacion` | string? | Token para verificar/reconciliar. **Nunca se expone en la API pública.** |
| `asunto` | string | `CGPA - <concepto>`; lo que ve el apoderado. |
| `moneda` | `'CLP'` | Fija. |
| `monto` | int | Pesos chilenos, sin decimales. |
| `pagador_email` / `pagador_nombre` | string | Datos del apoderado (no se exponen en la consulta pública). |
| `estado` | `EstadoPago` | Estado normalizado. |
| `estado_detalle` | string? | Detalle informado por el proveedor. |
| `banco` | string? | Banco de origen, si el proveedor lo informa. |
| `url_pago` | string? | Portal de pago usado en la redirección. |
| `pagado_en` | timestamp? | Se fija una sola vez al confirmar el pago. |
| `creado_en` / `actualizado_en` | timestamp | Auditoría básica. |

### Transiciones de estado

| Estado actual | Estado notificado | ¿Se aplica? |
|---|---|---|
| `PENDIENTE` | `PENDIENTE` | Sí — refresca detalle y banco |
| `PENDIENTE` | `PAGADO` | Sí |
| `PENDIENTE` | `CANCELADO` / `FALLIDO` | Sí |
| `CANCELADO` / `FALLIDO` | `PAGADO` | Sí — confirmación tardía del banco |
| `CANCELADO` / `FALLIDO` | `CANCELADO` / `FALLIDO` (distinto) | Sí — corrige el motivo |
| `PENDIENTE` / `CANCELADO` / `FALLIDO` | `PENDIENTE` | No |
| `PAGADO` | cualquiera | No — el pago es terminal |

Además se descarta el cambio (sin error HTTP) cuando: el cobro no existe, la notificación llega por
otra pasarela, o el monto/moneda informados no coinciden exactamente con el cobro registrado.

---

## 4. Contrato `PasarelaPago`

```ts
export interface PasarelaPago {
  readonly id: ProveedorPago;
  readonly nombre: string;

  /** Crea el cobro en el proveedor y devuelve su referencia y URL de pago. */
  crearCobro(solicitud: SolicitudCobro): Promise<CobroCreado>;

  /** Extrae la referencia a verificar del cuerpo de la notificación. */
  extraerReferenciaNotificacion(payload: Record<string, unknown>): string | null;

  /** Verifica el pago contra el proveedor y normaliza el resultado. */
  verificarPago(referencia: string): Promise<PagoVerificado | null>;
}
```

`SolicitudCobro` entrega ya resueltos `transactionId`, `asunto`, `monto`, datos del pagador,
`urlRetorno`, `urlCancelacion`, `urlNotificacion` y `expiraEn`. La pasarela **no** decide el
identificador interno, ni las URLs de retorno, ni el monto: todo eso lo genera el orquestador para
que un cliente no pueda alterarlo.

`PagoVerificado` devuelve `transactionId`, `monto`, `moneda`, `estado`, y opcionalmente
`estadoDetalle`, `referenciaExterna`, `banco` y `pagadoEn`. El orquestador usa `monto` y `moneda`
para contrastar contra el registro local.

---

## 5. Endpoints

| Método | Ruta | Acceso | Respuesta |
|---|---|---|---|
| `POST` | `/api/pagos/:proveedor` | Público | `201` con `{ transaction_id, proveedor, payment_url, referencia_externa }` |
| `POST` | `/api/pagos/:proveedor/webhook` | Público | `200` con `{ recibido: true, estado }` |
| `GET` | `/api/pagos/:transactionId` | Público | Datos no sensibles del cobro |
| `GET` | `/api/pagos` | `ADMIN` activo | Últimos 200 cobros, ordenados por `creado_en` desc, sin `token_notificacion` |

`GET /api/pagos/:transactionId` devuelve solo `transaction_id`, `proveedor`, `asunto`, `moneda`,
`monto`, `estado`, `estado_detalle`, `banco`, `pagado_en`, `creado_en` y `actualizado_en`.

Si el cobro sigue `PENDIENTE` y ya tiene `token_notificacion`, la consulta reconcilia contra la
pasarela antes de responder: el apoderado no depende de que el webhook haya llegado primero.

`PagosService.procesarNotificacion()` devuelve `{ actualizado, estado, transactionId }`. El
`transactionId` corresponde al cobro ya verificado por la pasarela, de modo que un controlador de
retorno propio puede construir la redirección sin confiar en el cuerpo de la petición.

### Flujo completo (Khipu)

1. El apoderado completa `/pagar` y el cliente llama `POST /api/pagos/khipu`.
2. El orquestador genera `transaction_id`, `return_url`, `cancel_url`, `notify_url` y `expires_date`;
   la pasarela crea el cobro y devuelve `payment_url`.
3. El cliente redirige al portal del proveedor.
4. El apoderado paga y vuelve a `/pagar/confirmacion?transaction_id=…`.
5. El proveedor notifica a `POST /api/pagos/:proveedor/webhook`.
6. El orquestador pide a la pasarela que **verifique el pago servidor a servidor** y aplica el
   resultado de forma idempotente.

---

## 6. Configuración

Variables de `apps/api` (ver [`.env.example`](../apps/api/.env.example)):

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PUBLIC_API_URL` | No | URL pública de la API. De ella se deriva `<…>/pagos/<proveedor>/webhook`. Si falta, se usa `VERIFICATION_BASE_URL` + `/api`. |
| `CLIENT_BASE_URL` | No | URL del frontend para `return_url` y `cancel_url`. Si falta, se usa `VERIFICATION_BASE_URL`. |
| `PAGO_TTL_DIAS` | No | Vigencia de cada cobro en días (por defecto `7`). |
| `KHIPU_API_KEY` | Sí, si Khipu está activo | Clave del portal de desarrolladores. |
| `KHIPU_API_BASE_URL` | No | Base de la API v3. |

Las credenciales de cada proveedor se inyectan en Cloud Run desde GitHub Secrets
(`.github/workflows/release-deploy.yml`). En desarrollo local, el webhook exige una URL accesible
desde internet: expón la API con un túnel (`ngrok http 3000`) y usa esa URL en `PUBLIC_API_URL`.

---

## 7. Reglas de seguridad

1. **Nunca se confía en el cuerpo de la notificación.** Solo se toma la referencia y se consulta al
   proveedor con credenciales de servidor.
2. **El cliente no controla** el monto final, el `transaction_id`, el destinatario ni las URLs de
   retorno: los genera el backend.
3. **Idempotencia**: un `PAGADO` no retrocede; las notificaciones duplicadas o fuera de orden no
   generan escrituras.
4. **Coherencia**: se descarta la notificación si el proveedor no coincide con el del cobro o si el
   monto/moneda no coinciden.
5. **Datos personales**: la consulta pública omite correo, nombre y `token_notificacion`.
6. **Firestore**: las reglas bloquean cualquier lectura/escritura directa a `pagos`; solo el Admin
   SDK opera la colección.
7. **Trazabilidad**: los errores de comunicación se registran con `Logger` (nunca se registran
   credenciales ni tokens completos).

---

## 8. Procedimiento: agregar una nueva pasarela

Ejemplo de referencia: agregar **Webpay Plus** como segundo método de pago.

### Paso 1 — Registrar el identificador en el modelo compartido

En [`packages/shared/src/models/pago.ts`](../packages/shared/src/models/pago.ts):

```ts
export const ProveedorPagoSchema = z.enum(['khipu', 'webpay']);

export const PROVEEDOR_PAGO_LABELS: Record<ProveedorPago, string> = {
  khipu: 'Khipu',
  webpay: 'Webpay',
};
```

Si la nueva pasarela debe ser la opción por defecto del formulario, actualiza
`PROVEEDOR_PAGO_PREDETERMINADO`.

> El enum es el contrato con el frontend: si falta aquí, la pasarela no se puede enviar ni mostrar.

### Paso 2 — Implementar la pasarela

Crea `apps/api/src/pagos/pasarelas/webpay/webpay-pasarela.ts`:

```ts
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type {
  CobroCreado,
  PagoVerificado,
  PasarelaPago,
  SolicitudCobro,
} from '../pasarela-pago.interface';

@Injectable()
export class WebpayPasarela implements PasarelaPago {
  readonly id = 'webpay' as const;
  readonly nombre = 'Webpay';

  private readonly logger = new Logger(WebpayPasarela.name);

  async crearCobro(solicitud: SolicitudCobro): Promise<CobroCreado> {
    // 1. Leer las credenciales y fallar con 503 si faltan.
    // 2. POST al endpoint de creación usando solicitud.monto,
    //    solicitud.transactionId como orden de compra y solicitud.urlRetorno.
    // 3. Devolver { referenciaExterna: token, urlPago: url }.
    throw new ServiceUnavailableException('pendiente de implementar');
  }

  extraerReferenciaNotificacion(payload: Record<string, unknown>): string | null {
    const token = payload['token_ws'];

    return typeof token === 'string' && token.trim().length > 0
      ? token.trim()
      : null;
  }

  async verificarPago(referencia: string): Promise<PagoVerificado | null> {
    // 1. Confirmar la transacción con credenciales de servidor (commit).
    // 2. Traducir el estado a EstadoPago y devolver monto/moneda del proveedor.
    // 3. Devolver null si la referencia no identifica un pago.
    return null;
  }
}
```

Reglas obligatorias para la implementación:

- **Credenciales**: leerlas de `process.env` y lanzar `ServiceUnavailableException` (503) si faltan,
  con un mensaje que no exponga el secreto.
- **Errores HTTP**: traducir fallos del proveedor a `BadGatewayException` (502) y registrarlos con
  `Logger`.
- **Estados**: mapear **todos** los estados del proveedor a `EstadoPago`; lo desconocido queda
  `PENDIENTE` (nunca `PAGADO` por defecto).
- **Campos opcionales**: no asignar `undefined`; solo agregar `estadoDetalle`, `referenciaExterna`,
  `banco` y `pagadoEn` cuando el proveedor los informe.
- **Timeout**: toda llamada externa debe tener un límite (`AbortSignal.timeout`).
- **Sin estado global**: la pasarela no persiste nada; eso lo hace el orquestador.

### Paso 3 — Registrarla en el módulo

En [`pagos.module.ts`](../apps/api/src/pagos/pagos.module.ts):

```ts
providers: [
  PagosService,
  PasarelasService,
  KhipuPasarela,
  WebpayPasarela,
  {
    provide: PASARELAS_PAGO,
    inject: [KhipuPasarela, WebpayPasarela],   // una entrada por pasarela
    useFactory: (...pasarelas: PasarelaPago[]) => pasarelas,
  },
],
```

Con esto, `POST /api/pagos/webpay` y `POST /api/pagos/webpay/webhook` ya funcionan: el controlador y
el orquestador son genéricos. Una pasarela no registrada responde `400` con
`Método de pago no soportado: <id>`.

### Paso 4 — Añadir la ruta de retorno si el protocolo lo exige

El webhook genérico sirve cuando el proveedor notifica con un cuerpo que identifica el pago. Si el
retorno requiere otra semántica HTTP (por ejemplo, responder con una **redirección**), agrega un
controlador propio para esa pasarela que delegue en el orquestador:

```ts
import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PagosService } from '../pagos.service';

@Controller('pagos/webpay')
export class WebpayRetornoController {
  constructor(private readonly pagos: PagosService) {}

  @Post('retorno')
  async retorno(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    // El orquestador verifica contra la pasarela e informa qué cobro afectó.
    const { estado, transactionId } = await this.pagos.procesarNotificacion(
      'webpay',
      body,
    );

    const destino = estado === 'PAGADO' ? 'confirmacion' : 'cancelado';
    const params = transactionId
      ? `?transaction_id=${encodeURIComponent(transactionId)}`
      : '';

    return res.redirect(
      302,
      `${process.env.CLIENT_BASE_URL}/pagar/${destino}${params}`,
    );
  }
}
```

> No dupliques la verificación ni la persistencia: siempre pasa por
> `PagosService.procesarNotificacion`, que devuelve `{ actualizado, estado, transactionId }`.
> Usa `transactionId` (ya verificado) en lugar del cuerpo de la petición para construir la
> redirección.

### Paso 5 — Exponer el método en el frontend (opcional)

`Pagar.vue` ya envía a `/pagos/:proveedor` y la página de confirmación es genérica. Para ofrecer
varios métodos, reemplaza el proveedor fijo por un selector:

```ts
const proveedorSeleccionado = ref<ProveedorPago>(PROVEEDOR_PAGO_PREDETERMINADO);
const opciones = Object.entries(PROVEEDOR_PAGO_LABELS) as [ProveedorPago, string][];

// en handleSubmit:
await apiClient.post(`/pagos/${proveedorSeleccionado.value}`, buildPagoPayload(form));
```

Recuerda actualizar `Pagar.spec.ts` para cubrir el selector.

### Paso 6 — Configuración, despliegue y documentación

1. Agregar las variables del proveedor a `apps/api/.env.example` bajo una sección propia.
2. Inyectarlas en Cloud Run (`--update-env-vars`) desde GitHub Secrets en
   `.github/workflows/release-deploy.yml`.
3. Registrar la URL de retorno/notificación en el panel del proveedor (sandbox y producción).
4. Documentar en [boton_de_pago.md](boton_de_pago.md) o en un documento hermano la especificación y
   el estado de la integración.

### Paso 7 — Tests (obligatorios)

| Nivel | Archivo | Qué debe cubrir |
|---|---|---|
| Unitario de pasarela | `pasarelas/<proveedor>/<proveedor>-pasarela.spec.ts` | Payload y headers, mapeo de **todos** los estados, errores 502/503, referencias inválidas |
| Unitario del registro | `pasarelas/pasarelas.service.spec.ts` | Alta de la nueva pasarela y rechazo de ids desconocidos |
| E2E | `test/pagos.e2e-spec.ts` | `POST /pagos/<proveedor>`, webhook y validaciones |
| Cliente (si hay selector) | `views/Pagar.spec.ts` | Envío con el proveedor elegido |

El pipeline exige **≥ 80 % de líneas, ramas, funciones y sentencias**; los archivos nuevos suelen
quedar en 100 %.

### Checklist final

- [ ] `ProveedorPagoSchema` y `PROVEEDOR_PAGO_LABELS` actualizados.
- [ ] Pasarela implementada y registrada en `PASARELAS_PAGO`.
- [ ] Ruta de retorno propia, si difiere del webhook genérico.
- [ ] Credenciales documentadas, en `.env.example` y en el workflow.
- [ ] Tests unitarios y e2e en verde; cobertura sobre el umbral.
- [ ] `pnpm --filter @cgpa/api build` y `pnpm --filter @cgpa/client build` sin errores.
- [ ] Flujo probado en sandbox del proveedor: pago exitoso, cancelado y reintento.

---

## 9. Notas para Webpay Plus

Aunque el contrato es el mismo, el protocolo difiere de Khipu en puntos que afectan la integración:

| Aspecto | Khipu | Webpay Plus |
|---|---|---|
| Inicio | `POST /payments` → `payment_url` | `POST …/transactions` → `token` + `url` |
| Verificación | `GET /payments/{notification_token}` | `PUT …/transactions/{token}` (*commit*) |
| Retorno | `GET` a `return_url` (SPA) | `POST` de Transbank a `return_url` con `token_ws` |
| Cancelación | `cancel_url` + `POST` de retorno | Transbank envía `TBK_TOKEN` (abortado) |
| Estados | `done`, `verifying`, `cancelled` | `AUTHORIZED`, `FAILED`, `INITIALIZED`, `NULLIFIED` |
| Credenciales | `x-api-key` | `Tbk-Api-Key-Id` + `Tbk-Api-Key-Secret` |

Implicancias concretas:

- El **commit** es la verificación: `verificarPago(token)` debe hacer el `PUT` y mapear el resultado.
- El `return_url` debe apuntar a la **API** (no a la SPA), porque Transbank devuelve un `POST`; desde
  ahí se confirma y se redirige a `/pagar/confirmacion` (Paso 4).
- `NULLIFIED` (anulación) no es equivalente a un pago cancelado por el usuario: conviene mapearlo a
  `CANCELADO` y registrar `estadoDetalle` para distinguirlo.
- No existe `expires_date`; el campo `expiraEn` de `SolicitudCobro` se ignora.

Verifica siempre la versión vigente de la API en la documentación oficial de Transbank antes de
implementar.

---

## 10. Solución de problemas

| Síntoma | Causa probable | Acción |
|---|---|---|
| `503` al crear el cobro | Falta la credencial del proveedor (`KHIPU_API_KEY`, etc.) | Configurar la variable y reiniciar el servicio |
| `502` al crear el cobro | Proveedor caído, credencial inválida o timeout | Revisar logs del `Logger` y el estado del proveedor |
| `400 Método de pago no soportado` | Pasarela no registrada en `PASARELAS_PAGO` o id con error de tipeo | Verificar `ProveedorPagoSchema` y el módulo |
| El pago quedó `PENDIENTE` | Webhook no llegó (URL no pública) o el banco aún verifica | Revisar `PUBLIC_API_URL`; la página de confirmación reconcilia sola |
| El webhook responde `200` pero no cambia el estado | Monto/moneda distintos, cobro inexistente o notificación de otra pasarela | Buscar en logs `Discrepancia en el pago` o `Notificación para un cobro desconocido` |
| El estado vuelve a `PENDIENTE` | No debería ocurrir: un `PAGADO` es terminal | Revisar que no se haya editado el documento manualmente |
| `404` en la página de confirmación | `transaction_id` ausente o incorrecto en la URL de retorno | Verificar `CLIENT_BASE_URL` y la construcción de `return_url` |

---

## 11. Referencias

- [boton_de_pago.md](boton_de_pago.md) — especificación de la integración Khipu v3.
- [README](../README.md#-botón-de-pago) — resumen funcional y variables de entorno.
- [arquitectura-infraestructura-traspaso.md](arquitectura-infraestructura-traspaso.md) — despliegue
  en Cloud Run y Firebase Hosting.

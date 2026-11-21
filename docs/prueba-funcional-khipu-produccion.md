# Prueba Funcional — Khipu en Producción

> **Objetivo:** validar el flujo de pago real contra la cuenta Khipu del CGPA
> directamente en producción, sin depender de un ambiente GCP de staging y sin
> exponer el backend local a internet.
>
> Contexto técnico: [integracion-pasarelas-pago.md](integracion-pasarelas-pago.md).
> Especificación del proveedor: [boton_de_pago.md](boton_de_pago.md).
> Alternativa local con túnel: [prueba-funcional-khipu-sandbox.md](prueba-funcional-khipu-sandbox.md).

---

## 1. Por qué se prueba en producción

Khipu notifica el pago a una URL HTTPS pública. Si el backend corre en el
notebook, el ISP puede impedir que Khipu lo alcance, por lo que el webhook nunca
llega y el flujo no se puede validar de punta a punta. La alternativa es:

1. desplegar el código real en producción;
2. mantener el botón **oculto** del menú, pie y sitemap;
3. entrar directo a `https://cgpagrahambell.cl/pagar`;
4. pagar un monto bajo real;
5. verificar webhook, estado y panel de administración;
6. recién entonces publicar el botón.

El endpoint y la página existen durante la prueba; lo único oculto es el enlace
público. Esto permite validar exactamente el mismo código que verá el apoderado.

---

## 2. Requisitos previos

- Cuenta de cobro Khipu del CGPA verificada. El identificador de cobrador del
  CGPA es **532013**; se usa solo como referencia para comprobar que el pago
  pertenece a la cuenta correcta.
- **API Key de producción** creada en el portal de Khipu
  (`https://khipu.com/merchant/profile#instant-notification-data`, sección
  *API Keys*). La tabla de API Keys del documento de identificación del cobrador
  estaba vacía al preparar esta guía.
  - En Khipu v3 la autenticación es `x-api-key: <API Key>`.
  - La **llave de cobrador** (merchant secret) **no** es la API Key; se usa para
    verificar la firma del webhook y no debe copiarse al repositorio.
- GitHub Secret `KHIPU_API_KEY` con la API Key de producción.
- GitHub Secret `VERIFICATION_BASE_URL` = `https://cgpagrahambell.cl`.
- Un usuario ADMIN activo para entrar a `/admin/pagos`.
- Una cuenta bancaria real para pagar un monto bajo de prueba.
- Monto sugerido para QA: entre `$100` y `$1.000` CLP. El dinero entra
  realmente a la cuenta del CGPA.

> El perfil de Khipu puede mostrar la *API de notificación 1.3* a nivel de
> cuenta y la URL de notificación vacía. **No es necesario configurarla** para
> esta integración: cada cobro se crea con su propio `notify_url`
> (`https://cgpagrahambell.cl/api/pagos/khipu/webhook`) y
> `notify_api_version: "3.0"`, y Khipu usa esa configuración por cobro. La
> página de confirmación además reconcilia por API si el webhook demora.

---

## 3. Despliegue con el botón oculto

El interruptor está en
[`apps/client/src/content/public-routes.ts`](../apps/client/src/content/public-routes.ts):

```ts
export const PAGOS_HABILITADOS = false;
```

Con `false`, `/pagar` se sigue prerenderizando y se puede abrir directo, pero:

- no aparece en el menú de escritorio;
- no aparece en el menú móvil ni en el pie;
- no se publica en `sitemap.xml`.

Pasos:

1. Merge del Pull Request a `master` con CI en verde.
2. Crear y empujar un tag de release (por ejemplo `v3.3.0`).
3. Esperar los jobs de frontend (Firebase Hosting) y backend (Cloud Run).
4. Verificar que el servicio `api` de Cloud Run tenga las variables:
   - `KHIPU_API_KEY` (no vacía),
   - `PUBLIC_API_URL=https://cgpagrahambell.cl/api`,
   - `CLIENT_BASE_URL=https://cgpagrahambell.cl`,
   - `PAGOS_COLECCION=pagos`,
   - `KHIPU_API_BASE_URL=https://payment-api.khipu.com/v3`.

No hace falta imprimir el valor de la API Key. El workflow
[`release-deploy.yml`](../.github/workflows/release-deploy.yml) inyecta estas
variables en cada release.

---

## 4. Verificaciones previas (sin pagar)

```bash
# La página existe y responde 200 aunque no esté enlazada
curl -sI https://cgpagrahambell.cl/pagar | head -3

# El sitio no enlaza el botón mientras está oculto
curl -s https://cgpagrahambell.cl | grep -i "Pagar / Donar" || echo "oculto"

# El sitemap no publica /pagar mientras está oculto
curl -s https://cgpagrahambell.cl/sitemap.xml | grep -i "/pagar" || echo "no publicado"

# El webhook es alcanzable desde internet (Firebase Hosting → Cloud Run)
curl -s -X POST https://cgpagrahambell.cl/api/pagos/khipu/webhook \
  -H 'Content-Type: application/json' \
  -d '{}'
# Esperado: {"recibido":true,"estado":null}
```

Si el webhook devuelve `404`, revisar el rewrite `/api/**` de
[`firebase.json`](../firebase.json) y que el servicio Cloud Run se llame `api`
en `southamerica-west1`.

---

## 5. Casos de prueba

### 5.1 Cuota anual

1. Abrir `https://cgpagrahambell.cl/pagar`.
2. Dejar seleccionada **Cuota anual 2027**.
3. Completar nombre y correo reales.
4. Usar un monto bajo (por ejemplo `$100`), o el monto sugerido si se quiere
   validar el importe real.
5. Opcional: indicar estudiante/curso.
6. Pulsar **Pagar con Khipu** y pagar en el portal.

Resultado esperado:

- retorno a `/pagar/confirmacion?transaction_id=…`;
- estado `PAGADO` (puede pasar por `PENDIENTE` unos segundos);
- en Firestore `pagos/<transaction_id>`:
  - `tipo_aporte = CUOTA_ANUAL`,
  - `periodo = 2027`,
  - `estado = PAGADO`,
  - `referencia_externa`, `pagado_en`, `banco`,
  - `estudiante` si se informó;
- en `/admin/pagos` aparece la fila y suma al total confirmado.

### 5.2 Donación voluntaria

1. Abrir `/pagar` y seleccionar **Donación voluntaria**.
2. Completar nombre y correo de cualquier persona (no necesita ser apoderado).
3. Indicar un monto libre bajo y pagar.

Resultado esperado:

- `tipo_aporte = DONACION`;
- sin `periodo` ni `estudiante`;
- el asunto es `CGPA - Donación voluntaria`;
- aparece en `/admin/pagos`.

### 5.3 Idempotencia del webhook

Con el `payment_id` real del pago confirmado (se ve en
`pagos/<transaction_id>.referencia_externa` o en los logs):

```bash
curl -s -X POST https://cgpagrahambell.cl/api/pagos/khipu/webhook \
  -H 'Content-Type: application/json' \
  -d '{"payment_id":"<payment_id>"}'
```

Esperado: `200` con estado `PAGADO`; en logs `actualizado: false`; el documento
no cambia.

### 5.4 Cancelación

1. Iniciar otro cobro y abandonar el portal de Khipu.
2. Verificar el retorno a `/pagar/cancelado`.

Khipu **no** notifica cancelaciones: el cobro queda `PENDIENTE` hasta su
`expires_date`. La página de cancelación explica que no se realizó ningún cargo.

### 5.5 Consulta pública sin webhook

La página de confirmación consulta `GET /api/pagos/:transaction_id` cada 3
segundos y, si el cobro sigue `PENDIENTE`, reconcilia contra Khipu con
`GET /v3/payments/{payment_id}`. Esto cubre el caso en que el webhook demore o
falle; no es necesario esperar la notificación para ver el estado.

---

## 6. Evidencias a revisar

### Logs de Cloud Run

En la consola de Cloud Run (`api`, `southamerica-west1`) o con:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND ("CGPA-PAY" OR "Notificación khipu")' \
  --limit=50 \
  --format='value(timestamp,textPayload,jsonPayload.message)'
```

Buscar, en orden:

```
Cobro khipu creado transaction_id=CGPA-PAY-… referencia=…
Notificación khipu recibida
Cobro CGPA-PAY-… actualizado: PENDIENTE → PAGADO
```

La línea `Notificación khipu recibida` distingue el webhook de la reconciliación
por polling. Nunca se registran tokens completos ni credenciales.

### Firestore

En la consola de Firebase → Firestore → colección `pagos`, abrir el documento
`CGPA-PAY-…` y revisar los campos de la sección 5.1/5.2.

> Las reglas de Firestore bloquean la lectura/escritura directa desde el cliente;
> la consola y el backend (Admin SDK) sí pueden leer.

### Panel de administración

Entrar como ADMIN a `https://cgpagrahambell.cl/admin/pagos`. La tabla muestra
fecha, tipo, monto, estado, pagador, estudiante/curso, banco y referencia.

---

## 7. Publicación del botón

Cuando todos los casos anteriores pasen:

1. Cambiar en
   [`public-routes.ts`](../apps/client/src/content/public-routes.ts):
   ```ts
   export const PAGOS_HABILITADOS = true;
   ```
2. Ejecutar tests y build:
   ```bash
   pnpm --filter @cgpa/client test
   pnpm --filter @cgpa/client build
   ```
3. PR + merge + nuevo tag (por ejemplo `v3.3.1`).
4. Verificar:
   - el menú de escritorio, el móvil y el pie muestran **Pagar / Donar**;
   - `curl -s https://cgpagrahambell.cl/sitemap.xml | grep '/pagar'` devuelve la
     URL;
   - `/pagar` sigue completando un cobro.

---

## 8. Rollback

- **Sitio:** volver `PAGOS_HABILITADOS = false` y hacer un release. El botón
  desaparece de menú/pie/sitemap; `/pagar` sigue disponible para diagnóstico.
- **Backend:** en Cloud Run → *Revisions*, enrutar el 100 % a la revisión
  anterior. El webhook y la consulta pública siguen funcionando con el código
  anterior.
- **Webhook caído:** la confirmación reconcilia por API; Khipu reintenta la
  notificación hasta por dos días. Revisar `PUBLIC_API_URL`, el rewrite de
  Hosting y los logs de Cloud Run.

---

## 9. Limpieza y conciliación

Los pagos de prueba son **reales** y quedan en la colección `pagos` como
primeros aportes del CGPA (decisión de la directiva). No es necesario borrarlos.

La conciliación contable sigue siendo manual: un pago confirmado **no** crea
automáticamente una transacción de ingreso. La directiva registra el ingreso en
el formulario de transacciones existente, con su respaldo, cuando corresponda.

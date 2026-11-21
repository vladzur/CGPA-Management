# Especificaciones Técnicas: Integración de Botón de Pago Khipu (v3)

Este documento contiene la especificación técnica completa para la integración del botón de pago de **Khipu (API v3)** en el backend de la aplicación de administración del Centro General de Padres y Apoderados (CGPA).

---

## 1. Información General y Flujo de Cobro

Khipu utiliza un esquema de **Cobro por Redirección y Notificación Asíncrona (Webhooks)** mediante simplificación de transferencias bancarias.

### Flujo de Pago Completo

```
[ Apoderado ]       [ Frontend App ]       [ Backend CGPA ]          [ API Khipu ]
      │                    │                      │                        │
      │── 1. Selecciona ──>│                      │                        │
      │   Khipu y Paga     │                      │                        │
      │                    │── 2. Crear cobro ───>│                        │
      │                    │   (POST /checkout)   │── 3. POST /payments ──>│
      │                    │                      │   (Headers: x-api-key) │
      │                    │                      │<── 4. Retorna URL ─────│
      │                    │<── 5. Redirección ───│      y payment_id      │
      │                    │    a payment_url     │                        │
      │                    │                      │                        │
      │── 6. Transfiere en el Portal de Khipu ───>│                        │
      │                                                                    │
      │                                           │<── 7. Notificación ────│
      │                                           │    Webhook (POST)      │
      │                                           │                        │
      │                                           │── 8. GET /payments ───>│
      │                                           │   /{payment_id}        │
      │                                           │<── 9. Retorna Pago ────│
      │                                           │       validado         │
      │                                           │                        │
      │<── 10. Redirección a return_url ──────────│                        │
```

---

## 2. Requisitos de Autenticación y Credenciales

Las llamadas a la API v3 requieren autenticación mediante encabezados HTTP.

* **Modo Integración / Sandbox:** Se obtienen desde el portal de desarrolladores de Khipu.
* **Modo Producción:** Vinculadas al `receiver_id` de la cuenta bancaria verificada del CGPA.

### Encabezados Requeridos en las Peticiones HTTP

```http
Content-Type: application/json
x-api-key: <TU_KHIPU_API_KEY>
```

---

## 3. Endpoints Principales

### 3.1. Crear Cobro (Payment Request)

Crea un intent de pago y devuelve la URL a la cual se debe redirigir al apoderado.

* **Método:** `POST`
* **URL:** `https://payment-api.khipu.com/v3/payments`

#### Cuerpo de la Petición (Request Body - JSON)

```json
{
  "subject": "CGPA - Cuota anual 2027",
  "currency": "CLP",
  "amount": 10000,
  "transaction_id": "CGPA-PAY-2027-4F3A9C2E1B7D8056",
  "payer_email": "apoderado@ejemplo.cl",
  "payer_name": "Juan Pérez",
  "return_url": "https://cgpagrahambell.cl/pagar/confirmacion",
  "cancel_url": "https://cgpagrahambell.cl/pagar/cancelado",
  "notify_url": "https://cgpagrahambell.cl/api/pagos/khipu/webhook",
  "notify_api_version": "3.0",
  "expires_date": "2026-12-31T23:59:59Z"
}
```

#### Parámetros Clave

| Campo            | Tipo     | Obligatorio | Descripción                                           |
|:---------------- |:-------- |:----------- |:----------------------------------------------------- |
| `subject`        | `String` | **Sí**      | Descripción del cobro que verá el apoderado.          |
| `currency`       | `String` | **Sí**      | Código de moneda en ISO 4217 (Usar `"CLP"`).          |
| `amount`         | `Number` | **Sí**      | Monto total en CLP sin decimales (Entero).            |
| `transaction_id` | `String` | **Sí**      | ID único interno en la base de datos del CGPA.        |
| `payer_email`    | `String` | **Sí**      | Correo del apoderado para enviar comprobante.         |
| `return_url`     | `String` | **Sí**      | URL donde vuelve el apoderado tras completar el pago. |
| `notify_url`     | `String` | **Sí**      | Endpoint del backend donde Khipu enviará el Webhook.  |

#### Respuesta Exitosa (Response 200 OK)

```json
{
  "payment_id": "abc123xyz456",
  "payment_url": "https://khipu.com/payment/info/abc123xyz456",
  "simplified_transfer_url": "https://khipu.com/app/encuesta/abc123xyz456",
  "transfer_url": "https://khipu.com/app/encuesta/abc123xyz456",
  "app_url": "khipu://page/abc123xyz456",
  "ready_for_terminal": false
}
```

---

### 3.2. Notificación Webhook (Recepción de Estado)

Khipu notificará a la `notify_url` configurada mediante una petición HTTP POST cuando el pago cambie de estado.

* **Método enviador por Khipu:** `POST`
* **Formato:** `application/json` (API de notificaciones `3.0`)

Los cobros creados con la API `3.0` solo admiten notificaciones `3.0`: el cuerpo
del webhook trae los datos del pago conciliado y **no** incluye
`notification_token`. El identificador que se usa para verificar es
`payment_id`.

#### Payload Recibido en Webhook

```json
{
  "payment_id": "abc123xyz456",
  "receiver_id": 532013,
  "subject": "CGPA - Cuota anual 2027",
  "amount": "10000.0000",
  "currency": "CLP",
  "transaction_id": "CGPA-PAY-2027-4F3A9C2E1B7D8056",
  "bank": "Banco Estado",
  "payer_name": "Juan Pérez",
  "payer_email": "apoderado@ejemplo.cl",
  "conciliation_date": "2026-11-02T16:09:00.859Z"
}
```

La cabecera `x-khipu-signature` (`t=<timestamp ms>,s=<hmac-sha256>`) permite
además verificar que el cuerpo no fue alterado.

> **REGLA DE SEGURIDAD CRÍTICA:** Nunca marques un pago como completado basándote únicamente en los datos recibidos en el cuerpo del webhook. Debes usar el `payment_id` para hacer una consulta de verificación servidor a servidor.

---

### 3.3. Consultar y Verificar Estado del Pago

Obtiene el detalle y valida el pago una vez recibido el Webhook.

* **Método:** `GET`
* **URL:** `https://payment-api.khipu.com/v3/payments/{payment_id}`

#### Encabezados

```http
x-api-key: <TU_KHIPU_API_KEY>
```

#### Respuesta Exitosa (Response 200 OK)

```json
{
  "payment_id": "abc123xyz456",
  "subject": "CGPA - Cuota anual 2027",
  "amount": "10000.0000",
  "currency": "CLP",
  "status": "done",
  "status_detail": "normal",
  "body": "",
  "payer_email": "apoderado@ejemplo.cl",
  "receipt_url": "https://khipu.com/payment/receipt/abc123xyz456",
  "notification_token": "token_de_notificacion_seguro_789xyz",
  "transaction_id": "CGPA-PAY-2027-4F3A9C2E1B7D8056",
  "custom": "",
  "bank": "Banco Estado",
  "bank_id": "012",
  "payer_name": "Juan Pérez",
  "conciliation_date": "2026-11-02T16:09:00.859Z"
}
```

#### Posibles Estados (`status`)

| Khipu | Estado interno |
|:--|:--|
| `done` | `PAGADO` |
| `verifying` | `PENDIENTE` |
| `pending` | `PENDIENTE` |

Khipu **no** informa `cancelled` ni `failed` como estado del pago: un cobro que
el apoderado abandona permanece `pending` hasta su `expires_date`. Los detalles
de rechazo llegan en `status_detail` (`rejected-by-payer`, `marked-as-abuse`).

---

## 4. Estructura de Persistencia Recomendada (BD Backend)

Tabla o colección `payments_khipu`:

```sql
CREATE TABLE khipu_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(100) NOT NULL UNIQUE, -- Referencia interna CGPA
    khipu_payment_id VARCHAR(100),                -- Retornado en createPayment
    notification_token VARCHAR(255),              -- Solo notificaciones 1.3 (legacy)
    amount INT NOT NULL,
    payer_email VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',-- PENDING, PAID, CANCELLED, FAILED
    bank_name VARCHAR(100),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 5. Buenas Prácticas y Manejo de Errores

1. **Idempotencia:** Asegurar que el webhook pueda procesar la misma notificación múltiples veces sin duplicar el registro contable o recibo del apoderado.
2. **Respuesta rápida al Webhook:** Responder inmediatamente con un código HTTP `200 OK` tras recibir la notificación y procesar la validación en segundo plano o de forma síncrona liviana.
3. **Mantenimiento y Logs:** Registrar en logs los errores de comunicación con Khipu para facilitar soporte técnico ante consultas de apoderados sobre sus transferencias.

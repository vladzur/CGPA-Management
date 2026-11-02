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
      │                                           │   /{notification_token}│
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
* **URL:** `https://khipu.com/api/v3/payments`

#### Cuerpo de la Petición (Request Body - JSON)

```json
{
  "subject": "Cuota Anual CGPA 2026 - Familia Pérez",
  "currency": "CLP",
  "amount": 25000,
  "transaction_id": "CGPA-PAY-2026-00123",
  "payer_email": "apoderado@ejemplo.cl",
  "payer_name": "Juan Pérez",
  "return_url": "https://app.cgpa.cl/pagos/confirmacion",
  "cancel_url": "https://app.cgpa.cl/pagos/cancelado",
  "notify_url": "https://api.cgpa.cl/v1/payments/khipu/webhook",
  "notify_api_version": "1.3",
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
* **Formato:** `application/x-www-form-urlencoded` o `application/json`

#### Payload Recibido en Webhook

```json
{
  "notification_token": "token_de_notificacion_seguro_789xyz"
}
```

> **REGLA DE SEGURIDAD CRÍTICA:** Nunca marques un pago como completado basándote únicamente en los datos recibidos en el cuerpo del webhook. Debes usar el `notification_token` para hacer una consulta de verificación servidor a servidor.

---

### 3.3. Consultar y Verificar Estado del Pago

Obtiene el detalle y valida el pago una vez recibido el Webhook.

* **Método:** `GET`
* **URL:** `https://khipu.com/api/v3/payments/{notification_token}`

#### Encabezados

```http
x-api-key: <TU_KHIPU_API_KEY>
```

#### Respuesta Exitosa (Response 200 OK)

```json
{
  "payment_id": "abc123xyz456",
  "subject": "Cuota Anual CGPA 2026 - Familia Pérez",
  "amount": 25000,
  "currency": "CLP",
  "status": "done",
  "status_detail": "normal",
  "body": "",
  "payer_email": "apoderado@ejemplo.cl",
  "receipt_url": "https://khipu.com/payment/receipt/abc123xyz456",
  "notification_token": "token_de_notificacion_seguro_789xyz",
  "transaction_id": "CGPA-PAY-2026-00123",
  "custom": "",
  "account_id": "12345",
  "ready_for_terminal": false,
  "bank": "Banco Estado",
  "bank_id": "012",
  "payer_name": "Juan Pérez",
  "transfer_date": "2026-11-02T16:09:00Z"
}
```

#### Posibles Estados (`status`)

* `done`: Pago verificado y acreditado correctamente (**Marcar cuota como PAGADA**).
* `verifying`: Pago recibido, en proceso de verificación bancaria.
* `cancelled`: El apoderado canceló la operación o expiró.

---

## 4. Estructura de Persistencia Recomendada (BD Backend)

Tabla o colección `payments_khipu`:

```sql
CREATE TABLE khipu_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(100) NOT NULL UNIQUE, -- Referencia interna CGPA
    khipu_payment_id VARCHAR(100),                -- Retornado en createPayment
    notification_token VARCHAR(255),              -- Retornado en Webhook
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

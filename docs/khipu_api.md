# API Pagos Instantáneos

La API Instant Payment de Khipu (versión 3.0) permite a comerciantes iniciar, consultar, confirmar,  reembolsar o eliminar pagos inmediatos mediante transferencias bancarias en tiempo real.  Entre sus principales funcionalidades se encuentran: obtener la lista de bancos disponibles  con detalles como límites, tarifas y logos; crear un pago especificando un banco o dejar que el  usuario elija; confirmar o solicitar el reembolso de un pago mediante su ID; y predecir el estado  de un pago usando machine learning. Esta API maneja autenticación mediante clave secreta en el  encabezado x-api-key, no requiere firmas, y utiliza certificados SSL de validación extendida para  asegurar la comunicación

Version: v3.0
License: API Pagos Instantáneos

## Servers

Producción
```
https://payment-api.khipu.com
```

## Security

### Api-Key

Type: apiKey
In: header
Name: x-api-key

## Download OpenAPI description

 - [API Pagos Instantáneos](https://docs.khipu.com/_bundle/apis/v3/instant-payments/openapi.yaml)

 - [GET /v3/banks](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/getbanks.md): Este método obtiene la lista de bancos que se pueden utilizar para pagar en esta cuenta de cobro.
 - [POST /v3/payments/{id}/confirm](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/postpaymentconfirmbyid.md): **Advertencia: Esta función sólo está disponible para los clientes que la hayan contratado de forma independiente. Para utilizarla, póngase en contacto con nosotros en soporte@khipu.com** Confirmar el
 - [GET /v3/payments/{id}](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/getpaymentbyid.md): Información completa del pago. Datos con los que fue creado y el estado actual del pago.
 - [DELETE /v3/payments/{id}](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/deletepaymentbyid.md): Borrar un pago. Solo se pueden borrar pagos que estén pendientes de pagar. Esta operación no puede deshacerse.
 - [POST /v3/payments](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/postpayment.md): Crea un pago en Khipu y obtiene las URLs para redirección al usuario para que complete el pago.
 - [POST /v3/payments/{id}/void](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/voidpaymentbyid.md): Anula el monto total de un pago. Esta operación solo se puede realizar en los comercios que recauden en cuenta Khipu y antes de la rendición de los fondos correspondientes.
 - [POST /v3/refunds](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/postrefund.md): Devolución total o parcial del monto de un pago. Con `type=full` el monto completo disponible para devolver queda marcado para devolución al pagador; con `type=partial` queda marcada la parte indicada
 - [GET /v3/refund-wallet/balance](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/getrefundwalletbalance.md): Obtiene el saldo disponible de la billetera de devoluciones del comercio. Para que las devoluciones se concreten, la billetera debe mantener un saldo mayor a las devoluciones del día; puede recargarse
 - [GET /v3/predict](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/getpredict.md): Predicción acerca del resultado de un pago, si podrá o no funcionar. Información adicional como máximo posible de transferir a un nuevo destinatario.
 - [GET /v3/predict/all](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/getpredictall.md): Predicción acerca del resultado de un pago para cada uno de los bancos disponibles para la cuenta de cobro, sin necesidad de indicar un banco. Permite ofrecerle al pagador solo los bancos con los que
 - [POST /v3/receivers](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/postreceiver.md): **Advertencia: Esta función sólo está disponible para los clientes que la hayan contratado de forma independiente. Para utilizarla, póngase en contacto con nosotros en soporte@khipu.com** Crear una nu
 - [GET /v3/receivers/children](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/getreceivers.md): **Advertencia: Esta función sólo está disponible para los clientes que la hayan contratado de forma independiente. Para utilizarla, póngase en contacto con nosotros en soporte@khipu.com** Obtener la l
 - [GET /v3/merchants/{id}/paymentMethods](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/getmerchantpaymentmethodsbyid.md): Obtiene el listado de medios de pago disponible para una cuenta de cobrador.
 - [POST /v3/payments/{id}/refunds](https://docs.khipu.com/apis/v3/instant-payments/openapi/other/postpaymentrefundsbyid.md): **Obsoleto:** este método fue reemplazado por [*Void payment by Id*](#operation/voidPaymentById) (`POST /v3/payments/{id}/void`). Reembolsa el monto total de un pago. Esta operación solo se puede real
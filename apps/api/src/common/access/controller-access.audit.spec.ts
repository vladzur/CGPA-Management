import { AppController } from '../../app.controller';
import { ComunicadosController } from '../../comunicados/comunicados.controller';
import { DocumentosController } from '../../documentos/documentos.controller';
import { LibroBalanceController } from '../../libro-balance/libro-balance.controller';
import { MensajesController } from '../../mensajes/mensajes.controller';
import { PagosController } from '../../pagos/pagos.controller';
import { ProyectosController } from '../../proyectos/proyectos.controller';
import { TransactionsController } from '../../transactions/transactions.controller';
import { UsuariosController } from '../../usuarios/usuarios.controller';
import { ACCESS_POLICY_KEY, type AccessPolicy } from './access.decorator';

const CONTROLLERS = [
  AppController,
  ComunicadosController,
  DocumentosController,
  LibroBalanceController,
  MensajesController,
  PagosController,
  ProyectosController,
  TransactionsController,
  UsuariosController,
] as const;

/**
 * Matriz de acceso objetivo de la sección 6.2 del plan.
 * Si se agrega una ruta sin declararla aquí, la prueba falla y obliga a decidir
 * su política antes de exponerla.
 */
const EXPECTED_POLICIES: Record<string, AccessPolicy> = {
  'AppController.getHello': 'PUBLIC',
  'ComunicadosController.findAllPublic': 'PUBLIC',
  'ComunicadosController.findAll': 'ADMIN',
  'ComunicadosController.findOne': 'ADMIN',
  'ComunicadosController.create': 'ADMIN',
  'ComunicadosController.update': 'ADMIN',
  'ComunicadosController.remove': 'ADMIN',
  'ComunicadosController.uploadImage': 'ADMIN',
  'DocumentosController.findByVerificationUuid': 'PUBLIC',
  'DocumentosController.findAll': 'ADMIN',
  'DocumentosController.findOne': 'ADMIN',
  'DocumentosController.create': 'ADMIN',
  'DocumentosController.update': 'ADMIN',
  'DocumentosController.sellar': 'ADMIN',
  'DocumentosController.generatePdf': 'ADMIN',
  'DocumentosController.remove': 'ADMIN',
  'LibroBalanceController.generar': 'ADMIN',
  'MensajesController.create': 'PUBLIC',
  'MensajesController.findAll': 'ADMIN',
  'MensajesController.update': 'ADMIN',
  'MensajesController.remove': 'ADMIN',
  'PagosController.crearPago': 'PUBLIC',
  'PagosController.webhook': 'PUBLIC',
  'PagosController.listarErroresPago': 'ADMIN',
  'PagosController.consultarPago': 'PUBLIC',
  'PagosController.listarPagos': 'ADMIN',
  'ProyectosController.create': 'ADMIN',
  'ProyectosController.findAll': 'PUBLIC',
  'ProyectosController.findOne': 'PUBLIC',
  'ProyectosController.update': 'ADMIN',
  'ProyectosController.finalizar': 'ADMIN',
  'ProyectosController.remove': 'ADMIN',
  'TransactionsController.createTransaction': 'ADMIN',
  'TransactionsController.verifyIntegrity': 'PUBLIC',
  'UsuariosController.register': 'AUTHENTICATED',
  'UsuariosController.getAll': 'ADMIN',
  'UsuariosController.getPending': 'ADMIN',
  'UsuariosController.approve': 'ADMIN',
  'UsuariosController.updateRole': 'ADMIN',
  'UsuariosController.toggleActive': 'ADMIN',
  'UsuariosController.delete': 'ADMIN',
};

describe('Controller access audit', () => {
  it('should declare an access policy on every HTTP handler', () => {
    const declared: Record<string, AccessPolicy> = {};

    for (const controller of CONTROLLERS) {
      for (const methodName of Object.getOwnPropertyNames(
        controller.prototype,
      )) {
        if (methodName === 'constructor') continue;

        const handler = (controller.prototype as any)[methodName];
        if (typeof handler !== 'function') continue;

        // Solo los métodos con path son handlers HTTP.
        const routePath = Reflect.getMetadata('path', handler);
        if (routePath === undefined) continue;

        const key = `${controller.name}.${methodName}`;
        const policy = Reflect.getMetadata(ACCESS_POLICY_KEY, handler);
        expect({ key, policy }).toEqual({
          key,
          policy: expect.stringMatching(/^(PUBLIC|AUTHENTICATED|ADMIN)$/),
        });
        declared[key] = policy;
      }
    }

    expect(declared).toEqual(EXPECTED_POLICIES);
  });

  it('should not keep legacy per-controller guards', () => {
    for (const controller of CONTROLLERS) {
      expect(Reflect.getMetadata('__guards__', controller)).toBeUndefined();
      for (const methodName of Object.getOwnPropertyNames(
        controller.prototype,
      )) {
        if (methodName === 'constructor') continue;
        const handler = (controller.prototype as any)[methodName];
        if (typeof handler !== 'function') continue;
        if (Reflect.getMetadata('path', handler) === undefined) continue;

        expect(Reflect.getMetadata('__guards__', handler)).toBeUndefined();
      }
    }
  });
});

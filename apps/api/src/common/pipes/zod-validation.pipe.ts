import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable } from '@nestjs/common';
import { ZodError } from 'zod';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      // Intentamos parsear y parsear el valor con Zod
      // Esto también ejecuta los preprocessors (como convertir strings ISO a Date)
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        // Formateamos los errores de forma amigable para la respuesta del API
        const zodErr = error as any;
        const issues = zodErr.issues || zodErr.errors || [];
        const formattedErrors = issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        
        throw new BadRequestException({
          message: 'Error de validación de datos',
          errors: formattedErrors,
        });
      }
      throw new BadRequestException('Fallo en la validación de la solicitud');
    }
  }
}

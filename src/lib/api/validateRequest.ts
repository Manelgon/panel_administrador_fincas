import { NextResponse } from 'next/server';
import { z } from 'zod';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'JSON inválido en el cuerpo de la petición' },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const field = firstError?.path.join('.') || 'campo';
    const message = firstError?.message || 'Datos no válidos';
    return {
      success: false,
      response: NextResponse.json(
        { error: `${field}: ${message}` },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

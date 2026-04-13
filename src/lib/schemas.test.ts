import { describe, it, expect } from 'vitest';
import {
  validateForm,
  comunidadFormSchema,
  incidenciaFormSchema,
  deudaFormSchema,
} from './schemas';

// =============================================================
// validateForm helper
// =============================================================

describe('validateForm', () => {
  it('retorna success true con datos válidos', () => {
    const result = validateForm(comunidadFormSchema, {
      nombre_cdad: 'Comunidad Test',
      tipo: 'comunidad de propietarios',
    });
    expect(result.success).toBe(true);
  });

  it('retorna success false con datos inválidos', () => {
    const result = validateForm(comunidadFormSchema, {
      nombre_cdad: '',
      tipo: 'comunidad de propietarios',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('devuelve el primer error como string legible', () => {
    const result = validateForm(comunidadFormSchema, { nombre_cdad: '', tipo: 'comunidad de propietarios' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================
// comunidadFormSchema
// =============================================================

describe('comunidadFormSchema', () => {
  it('acepta comunidad mínima válida', () => {
    const result = comunidadFormSchema.safeParse({
      nombre_cdad: 'Comunidad Las Palmas',
      tipo: 'comunidad de propietarios',
    });
    expect(result.success).toBe(true);
  });

  it('acepta tipo trasteros y aparcamientos', () => {
    const result = comunidadFormSchema.safeParse({
      nombre_cdad: 'Garajes Centro',
      tipo: 'trasteros y aparcamientos',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = comunidadFormSchema.safeParse({
      nombre_cdad: '',
      tipo: 'comunidad de propietarios',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza tipo inválido', () => {
    const result = comunidadFormSchema.safeParse({
      nombre_cdad: 'Test',
      tipo: 'tipo_inexistente',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================
// incidenciaFormSchema
// =============================================================

describe('incidenciaFormSchema', () => {
  it('acepta incidencia mínima válida', () => {
    const result = incidenciaFormSchema.safeParse({
      comunidad_id: '1',
      mensaje: 'Hay una gotera en el tejado',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza comunidad_id vacío', () => {
    const result = incidenciaFormSchema.safeParse({
      comunidad_id: '',
      mensaje: 'Hay una gotera',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza mensaje vacío', () => {
    const result = incidenciaFormSchema.safeParse({
      comunidad_id: '1',
      mensaje: '',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza teléfono con formato incorrecto', () => {
    const result = incidenciaFormSchema.safeParse({
      comunidad_id: '1',
      mensaje: 'Test',
      telefono: '12345', // menos de 9 dígitos
    });
    expect(result.success).toBe(false);
  });

  it('acepta teléfono vacío (opcional)', () => {
    const result = incidenciaFormSchema.safeParse({
      comunidad_id: '1',
      mensaje: 'Test',
      telefono: '',
    });
    expect(result.success).toBe(true);
  });

  it('acepta teléfono de 9 dígitos', () => {
    const result = incidenciaFormSchema.safeParse({
      comunidad_id: '1',
      mensaje: 'Test',
      telefono: '612345678',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza email con formato inválido', () => {
    const result = incidenciaFormSchema.safeParse({
      comunidad_id: '1',
      mensaje: 'Test',
      email: 'no-es-un-email',
    });
    expect(result.success).toBe(false);
  });

  it('acepta source válido', () => {
    const sources = ['visita comunidad', 'whatsapp', 'llamada', 'email', 'tratar proxima junta'] as const;
    for (const source of sources) {
      const result = incidenciaFormSchema.safeParse({
        comunidad_id: '1',
        mensaje: 'Test',
        source,
      });
      expect(result.success).toBe(true);
    }
  });
});

// =============================================================
// deudaFormSchema
// =============================================================

describe('deudaFormSchema', () => {
  const baseDeuda = {
    comunidad_id: '1',
    nombre_deudor: 'Juan García',
    titulo_documento: 'Cuota ordinaria',
    fecha_notificacion: '2026-01-15',
    importe: '250.50',
  };

  it('acepta deuda mínima válida', () => {
    const result = deudaFormSchema.safeParse(baseDeuda);
    expect(result.success).toBe(true);
  });

  it('rechaza nombre_deudor vacío', () => {
    const result = deudaFormSchema.safeParse({ ...baseDeuda, nombre_deudor: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza importe no numérico', () => {
    const result = deudaFormSchema.safeParse({ ...baseDeuda, importe: 'no-es-numero' });
    expect(result.success).toBe(false);
  });

  it('acepta importe con coma decimal', () => {
    const result = deudaFormSchema.safeParse({ ...baseDeuda, importe: '1.250,75' });
    expect(result.success).toBe(true);
  });

  it('rechaza fecha_notificacion vacía', () => {
    const result = deudaFormSchema.safeParse({ ...baseDeuda, fecha_notificacion: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza comunidad_id vacío', () => {
    const result = deudaFormSchema.safeParse({ ...baseDeuda, comunidad_id: '' });
    expect(result.success).toBe(false);
  });
});

// OBSOLETO para la interfaz: el catálogo vivo es la tabla
// `tipos_servicio_contrato` y se gestiona desde Proveedores → Tipos de servicio.
// Esta lista solo la usa scripts/import-contratos.ts (importación histórica del
// Excel) y coincide con la semilla de la migración. Editarla NO cambia la app.
export const TIPOS_SERVICIO_CONTRATO = [
    'Seguro multirriesgo',
    'Electricidad',
    'Ascensores',
    'Limpieza',
    'Suministro de agua',
    'Extintores / Contraincendios',
    'Grupo de presión',
    'Protección de datos RGPD',
    'Antenas / Telecomunicaciones',
    'Cámaras / Seguridad',
    'Puertas de garaje',
    'Control de plagas',
    'Piscina',
    'Obras y reformas',
    'Jardinería',
    'Mantenimiento general',
    'Prevención de riesgos laborales',
    'Energía solar',
    'Banca / Cuenta corriente',
    'Servicios jurídicos',
    'ITE',
    'Otro',
] as const;

export type TipoServicioContrato = (typeof TIPOS_SERVICIO_CONTRATO)[number];

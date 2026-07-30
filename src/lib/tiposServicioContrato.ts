// Catálogo cerrado de tipos de servicio de contratos con proveedores.
// La BD guarda TEXT libre, pero la UI solo permite estos valores (PRP-004).
// Derivado de los tipos reales del histórico (Contratos.xls) consolidados.
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

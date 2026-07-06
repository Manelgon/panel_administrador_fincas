# Registro de Actividades de Tratamiento (RoPA)

**Responsable:** Serincosol S.L. · CIF B09915075
**Domicilio:** Pasaje Pezuela 1, 1º A Dcha, 29010 Málaga
**Contacto:** administracion@serincosol.com
**Base normativa:** art. 30 RGPD (Reglamento UE 2016/679) y Ley Orgánica 3/2018 (LOPDGDD)
**Última actualización:** julio de 2026

> ⚠️ **Borrador.** Documento generado a partir del análisis del panel de gestión. Debe
> ser revisado y completado por el responsable / asesor antes de considerarse definitivo.
> Los puntos marcados **[REVISAR]** requieren confirmación.

---

## Tratamiento 1 — Gestión de comunidades de propietarios

| Campo | Detalle |
|---|---|
| **Finalidad** | Administración de fincas: gestión de incidencias, comunicaciones, documentación y reuniones/actas de las comunidades. |
| **Categorías de interesados** | Propietarios, presidentes de comunidad, proveedores. |
| **Categorías de datos** | Identificativos (nombre, apellidos), contacto (email, teléfono, dirección postal), datos de la finca. |
| **Base jurídica** | Ejecución del contrato de administración (art. 6.1.b) + cumplimiento de la Ley de Propiedad Horizontal (art. 6.1.c). |
| **Destinatarios / encargados** | Supabase (BD/almacenamiento, UE), Vercel (hosting), n8n (notificaciones), Microsoft OneDrive (facturas). |
| **Transferencias internacionales** | Ver sección "Encargados y transferencias". |
| **Plazo de conservación** | Duración de la relación de administración + plazos de prescripción. [REVISAR] |
| **Medidas de seguridad** | Control de acceso por credenciales y rol, RLS en base de datos, cifrado en tránsito (TLS), registro de actividad. |

## Tratamiento 2 — Gestión de morosidad

| Campo | Detalle |
|---|---|
| **Finalidad** | Seguimiento y reclamación de deudas de propietarios con la comunidad. |
| **Categorías de interesados** | Propietarios deudores. |
| **Categorías de datos** | Identificativos, contacto, importe y concepto de la deuda (datos de solvencia patrimonial). |
| **Base jurídica** | Interés legítimo de la comunidad / ejecución de contrato (art. 6.1.b/6.1.f). [REVISAR] |
| **Destinatarios / encargados** | Supabase, n8n (envío de avisos por email/WhatsApp). |
| **Plazo de conservación** | Hasta la resolución de la deuda + plazos de prescripción. [REVISAR] |
| **Observaciones** | La comunicación de deudas por WhatsApp/email debe minimizarse a lo imprescindible. |

## Tratamiento 3 — Gestión de incidencias

| Campo | Detalle |
|---|---|
| **Finalidad** | Registro y resolución de incidencias comunicadas por vecinos y proveedores. |
| **Categorías de interesados** | Propietarios, vecinos, proveedores. |
| **Categorías de datos** | Identificativos, contacto, contenido de la incidencia (texto libre). |
| **Base jurídica** | Ejecución del contrato de administración (art. 6.1.b). |
| **Destinatarios / encargados** | Supabase, n8n. |
| **Plazo de conservación** | Duración de la gestión + plazos de prescripción. [REVISAR] |

## Tratamiento 4 — Control horario del personal

| Campo | Detalle |
|---|---|
| **Finalidad** | Registro de la jornada laboral (fichajes de entrada/salida). |
| **Categorías de interesados** | Personal empleado de Serincosol S.L. |
| **Categorías de datos** | Identificativos, marcas horarias, notas de la jornada. |
| **Base jurídica** | Obligación legal (art. 34.9 Estatuto de los Trabajadores; art. 6.1.c RGPD). |
| **Destinatarios / encargados** | Supabase. Puesta a disposición de la Inspección de Trabajo cuando proceda. |
| **Plazo de conservación** | **4 años** (art. 34.9 ET). Los registros no se borran al dar de baja a un empleado. |
| **Medidas de seguridad** | FK con `ON DELETE RESTRICT` para impedir el borrado accidental; baja de empleados mediante desactivación (no eliminación). |

## Tratamiento 5 — Gestión de vacaciones y ausencias del personal

| Campo | Detalle |
|---|---|
| **Finalidad** | Solicitud, aprobación y control de saldos de vacaciones. |
| **Categorías de interesados** | Personal empleado. |
| **Categorías de datos** | Identificativos, fechas, tipo de ausencia, comentarios. |
| **Base jurídica** | Ejecución de la relación laboral (art. 6.1.b). |
| **Destinatarios / encargados** | Supabase. |
| **Plazo de conservación** | Duración de la relación laboral + plazos legales. [REVISAR] |
| **Observaciones** | No deben consignarse motivos médicos/de salud en los campos de comentario libre. |

## Tratamiento 6 — Emisión y envío de documentos

| Campo | Detalle |
|---|---|
| **Finalidad** | Generación y envío de certificados de renta, suplidos, presupuestos y documentos varios. |
| **Categorías de interesados** | Propietarios, proveedores. |
| **Categorías de datos** | Identificativos, contacto, NIF/CIF, importes. |
| **Base jurídica** | Ejecución del contrato de administración / obligaciones fiscales (art. 6.1.b/6.1.c). |
| **Destinatarios / encargados** | Supabase, n8n (envío por email), OpenAI (análisis asistido de presupuestos con IA). |
| **Transferencias internacionales** | OpenAI (EE.UU.) — ver abajo. |
| **Plazo de conservación** | Plazos contables y fiscales aplicables. [REVISAR] |

---

## Encargados de tratamiento y transferencias internacionales

| Encargado | Servicio | Ubicación | Garantía para transferencia | DPA firmado |
|---|---|---|---|---|
| Supabase | Base de datos y almacenamiento | UE (Irlanda, `eu-west-1`) | No aplica (EEE) | [REVISAR / archivar] |
| Vercel | Hosting de la aplicación | EE.UU. / global | DPF y/o SCC | [REVISAR] |
| Microsoft (OneDrive) | Almacenamiento de facturas | UE / EE.UU. | DPF y/o SCC | [REVISAR] |
| OpenAI | Análisis de documentos con IA | EE.UU. | DPF + no entrenamiento con datos de la API | [REVISAR / confirmar no-training] |
| Proveedor n8n | Automatizaciones y envíos | [REVISAR ubicación del servidor] | [REVISAR] | [REVISAR — formalizar encargo] |

---

## Pendientes de cumplimiento (plan de acción)

- [ ] Firmar/archivar los contratos de encargado (art. 28) con cada proveedor de la tabla anterior.
- [ ] Confirmar la ubicación del servidor n8n y formalizar el encargo de tratamiento.
- [ ] Confirmar y documentar que OpenAI no entrena con los datos enviados por la API.
- [ ] Revisar y validar los plazos de conservación marcados **[REVISAR]**.
- [ ] Aprobar y publicar la Política de Privacidad y el Aviso Legal (ya disponibles en `/legal`).
- [ ] Registro de formación del personal en materia de IA (art. 4 EU AI Act).
- [ ] Procedimiento de notificación de brechas en 72 h (art. 33 RGPD).

# Propuesta: Firma electrónica y comunicaciones certificadas en el Panel de Gestión

**Para:** Administración de Serincosol
**Asunto:** Incorporar firma electrónica con validez legal y email/SMS certificado al panel de gestión de fincas
**Fecha:** Junio de 2026

---

## 1. Resumen ejecutivo

Proponemos incorporar al panel de gestión la posibilidad de **firmar documentos electrónicamente con plena validez legal** (actas de junta, contratos con proveedores y contratos con presidentes de comunidad), así como **enviar comunicaciones certificadas** (convocatorias y notificaciones) con valor probatorio.

Esto elimina desplazamientos, impresiones y firmas en papel, agiliza la gestión y deja constancia legal de cada envío y cada firma. La inversión es baja (**desde ~360–720 €/año**) y la implantación sencilla, porque el panel ya cuenta con la base técnica necesaria.

---

## 2. ¿Qué problema resuelve?

Hoy, cada acta o contrato exige imprimir, desplazarse, recoger firmas físicas y archivar papel. Esto implica:

- Tiempo y desplazamientos del despacho y de los firmantes.
- Riesgo de extravío y de documentos sin firmar.
- Dificultad para **demostrar** que una convocatoria o notificación se envió en plazo (algo que la Ley de Propiedad Horizontal exige).

Con firma electrónica y envío certificado, el presidente o el proveedor **firma desde el móvil en segundos**, y el sistema guarda automáticamente el documento firmado junto con las **pruebas legales** de identidad, fecha y entrega.

---

## 3. La decisión clave: ¿lo construimos nosotros o usamos un proveedor especializado?

Existen dos formas de hacerlo, y conviene entender por qué solo una es viable:

| | Construirlo nosotros desde cero | Usar un proveedor especializado |
|---|---|---|
| Validez legal de la firma | **Baja** (firma "simple", fácil de impugnar) | **Alta** (firma avanzada con garantías) |
| Email/SMS **certificado** | **Imposible** legalmente sin un tercero | **Sí, incluido** |
| Coste de desarrollo | Alto (semanas de trabajo) | Bajo (integración sencilla) |
| Mantenimiento legal | A nuestra cuenta, para siempre | Lo asume el proveedor |
| Si un firmante lo niega ante un juez | Nos toca demostrarlo a nosotros | El proveedor aporta el certificado de evidencias |

**Conclusión:** la validez legal de la firma avanzada y del email/SMS certificado **solo la puede emitir un Prestador Cualificado de Servicios de Confianza** (una figura regulada por la UE). No se puede "fabricar" internamente. Por eso lo correcto es **usar un proveedor para el núcleo legal e integrarlo en nuestro propio panel**, de modo que los documentos sigan viviendo en Serincosol y todo quede automatizado con nuestros módulos.

> Nota: empresas del sector como **Fincatech** funcionan exactamente así: no inventan la firma, integran a uno de estos proveedores y lo ofrecen dentro de su producto. Nosotros haríamos lo mismo, pero dentro de **nuestro propio panel**, manteniendo el control de los datos.

---

## 4. ¿Es legalmente válido? (marco normativo)

Sí, con plena seguridad jurídica:

- Se rige por el **Reglamento europeo eIDAS (UE 910/2014)** y la **Ley española 6/2020**.
- Una firma **no pierde validez por ser electrónica** (art. 25 eIDAS).
- Para nuestros documentos (actas, contratos) basta la **Firma Electrónica Avanzada (AES)**, que vincula al firmante mediante código por SMS/email, sello de tiempo y registro de evidencias. **No** hace falta certificado digital ni DNI electrónico por parte de los firmantes (firman desde el móvil sin instalar nada).
- En materia de protección de datos (RGPD), bastará con firmar el contrato de encargado con el proveedor, actualizar la política de privacidad y el registro de actividades; trámites estándar y sencillos.

**Por tipo de documento:**

| Documento | Quién firma | Nivel necesario |
|---|---|---|
| Actas de junta | Presidente + Secretario/Administrador | Avanzada + sello de tiempo |
| Contratos con proveedores | Administrador + proveedor | Avanzada |
| Contratos con presidentes | Despacho + presidente | Avanzada |

---

## 5. Comparativa de proveedores y precios

Estos son los proveedores españoles que cubren **firma avanzada + email/SMS certificado** con validez eIDAS:

| Proveedor | Qué incluye | Precio orientativo | Observaciones |
|---|---|---|---|
| **Firmafy** ⭐ | Firma avanzada (6 evidencias), email y SMS certificado, plantillas, firma múltiple | **Business: 360 €/año** (200 envíos, 2 usuarios) · **Enterprise: 720 €/año** (500 envíos, 5 usuarios, API, 300 SMS) | Pensado para administradores de fincas. Mejor relación calidad-precio. La integración con nuestro panel requiere el plan Enterprise (incluye API). |
| **Viafirma** | Firma avanzada/cualificada muy configurable, notificaciones electrónicas | A medida (según ellos, 70–80 % más barato que Signaturit) | Máxima flexibilidad técnica. Precio negociado, requiere presupuesto. |
| **Signaturit** | Todas las modalidades de firma, email certificado, máxima robustez | Desde ~10–50 €/usuario/mes + extras | Líder europeo, pero el coste sube rápido con el volumen. |
| **Lleida.net** | Especialista en email/SMS certificado con valor probatorio | Sistema de créditos (desde ~10 €) | Ideal como complemento si se hace mucho envío certificado. |

*(Precios orientativos a fecha de la propuesta; conviene confirmarlos en demo/presupuesto.)*

---

## 6. Recomendación

**Contratar Firmafy (plan Enterprise) como motor de firma e integrarlo en nuestro panel.**

Motivos:
- Cubre los tres tipos de documento que necesitamos, incluida la **firma múltiple** que requieren las actas (presidente + secretario).
- Incluye **email y SMS certificado** para convocatorias y notificaciones de acuerdos.
- **Precio cerrado y predecible** (720 €/año), sin sorpresas por usuario.
- Está orientado al sector de administración de fincas.

Antes de cerrar, se solicitará la **prueba gratuita de Firmafy** (7 días, sin tarjeta) y, en paralelo, **presupuesto a Viafirma** para comparar. Así la decisión final se toma con datos reales.

---

## 7. Estimación de coste anual

| Escenario | Volumen mensual | Plan recomendado | Coste anual |
|---|---|---|---|
| Uso bajo | Hasta ~15 firmas/mes | Firmafy Business | **~360 €/año** |
| Uso medio | ~40 firmas/mes | Firmafy Enterprise | **~720 €/año** |
| Uso alto | >40 firmas/mes | Enterprise + extras / Viafirma | Presupuesto a medida |

A esto se añade el trabajo de **integración técnica en el panel** (puntual, ya disponemos de gran parte de la base): conexión con el proveedor, pantallas de envío y seguimiento de firmas, y archivo automático del documento firmado.

> Para afinar el plan exacto necesitamos un dato: **¿cuántas actas/contratos se firman al mes aproximadamente?**

---

## 8. Próximos pasos

1. **Aprobación** de la dirección para avanzar.
2. Solicitar **prueba gratuita de Firmafy** y **presupuesto a Viafirma**.
3. Confirmar el **volumen mensual** estimado para elegir plan.
4. Tramitar la parte legal (contrato de encargado + actualización de política de privacidad).
5. **Integrar** la firma en el panel (envío, seguimiento, archivo automático) y formar al equipo.

---

*Documento elaborado para la valoración interna de Serincosol. Las cifras de precios son orientativas y se confirmarán mediante demo y presupuesto antes de la contratación.*

# PRP-002: Parámetros configurables en el análisis de presupuestos IA

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-02
> **Proyecto**: Panel gestión de fincas - Serincosol

---

## Objetivo

Añadir un panel de parámetros de configuración en el formulario de análisis de presupuestos, previo al botón "Analizar con IA", para que el usuario pueda definir: (1) un porcentaje de subida global aplicado a todas las partidas ordinarias, y (2) un tratamiento especial para la partida "gastos varios". Estos parámetros se inyectan dinámicamente en el `SYSTEM_PROMPT` del API route para que la IA los respete al generar el presupuesto.

---

## Por Qué

| Problema | Solución |
|----------|----------|
| La IA aplica subidas a su criterio sin respetar la directriz del administrador | El usuario fija un % de subida global antes del análisis y la IA lo respeta de forma obligatoria |
| "Gastos varios" suele tener importes no recurrentes que distorsionan el presupuesto | El usuario elige explícitamente cómo tratarlos: mantener, subir %, fijar importe, o dejar a criterio IA |
| El resultado IA obliga siempre a edición manual posterior para corregir cuotas | Con parámetros preconfigurados, el resultado ya sale ajustado al criterio real del administrador |

**Valor de negocio**: Reduce el tiempo de revisión y edición manual del análisis IA, y evita que el administrador tenga que rehacer el análisis por no concordar con su criterio de subida.

---

## Qué

### Criterios de Éxito

- [ ] El formulario muestra un panel "Parámetros del análisis" entre la selección de comunidad y los file pickers, o justo encima del botón "Analizar con IA"
- [ ] El usuario puede establecer un % de subida global (0–50 %) con un input numérico; si se deja en 0, la IA aplica su propio criterio
- [ ] El usuario puede elegir el tratamiento de "gastos varios" mediante un selector con 4 opciones: mantener igual / subir X% / importe fijo / dejar a criterio IA
- [ ] Los parámetros se envían al API route junto con los PDFs (vía FormData)
- [ ] El `SYSTEM_PROMPT` se construye dinámicamente incluyendo instrucciones condicionales basadas en esos parámetros
- [ ] El flujo completo (form → analyze → review → generate) sigue funcionando sin regresiones
- [ ] `npm run build` y `npm run typecheck` pasan sin errores

### Comportamiento Esperado (Happy Path)

1. El usuario abre el formulario de presupuesto (modal o página).
2. Selecciona comunidad (opcional) y sube los dos PDFs.
3. En el panel "Parámetros del análisis" configura:
   - **% subida global**: p. ej. `3` → todas las partidas ordinarias subirán ~3 % respecto al gasto anterior.
   - **Gastos varios**: elige `Mantener igual` → la IA no modifica esa partida.
4. Pulsa "Analizar con IA".
5. El frontend añade los parámetros al `FormData` (`pct_subida_global`, `gastos_varios_modo`, `gastos_varios_valor`).
6. El API route lee los parámetros, construye el `SYSTEM_PROMPT` con instrucciones específicas y llama a OpenAI.
7. La IA devuelve el JSON respetando esos parámetros.
8. El usuario ve la pantalla de revisión con los valores ya ajustados.

---

## Contexto

### Referencias

- `src/app/api/documentos/presupuestos/analyze/route.ts` — API route actual con `SYSTEM_PROMPT` estático. Aquí se inyectarán los parámetros.
- `src/app/dashboard/documentos/presupuestos/presupuestos-form.tsx` — UI del formulario. Aquí se añade el panel de parámetros. El `analyze()` a línea 196 construye el `FormData`; hay que añadir los campos nuevos.
- Patrón `FormData` ya en uso: `liquidacion`, `cuotas`, `comunidad_codigo` → añadir `pct_subida_global`, `gastos_varios_modo`, `gastos_varios_valor`.

### Arquitectura Propuesta

No se necesita nueva feature folder ni nueva tabla en BD. Los cambios se concentran en dos archivos existentes:

```
src/app/api/documentos/presupuestos/analyze/
└── route.ts           ← construir SYSTEM_PROMPT dinámico con parámetros

src/app/dashboard/documentos/presupuestos/
└── presupuestos-form.tsx  ← añadir estado + UI del panel de parámetros
```

Los parámetros se pasan vía `FormData` en la misma petición POST existente. No se persisten en BD (son configuración puntual por análisis, no global).

### Modelo de Datos

No se requieren cambios en la base de datos. Los parámetros viajan en la petición HTTP y se usan únicamente durante la construcción del prompt.

**Tipos nuevos en el formulario:**

```typescript
type GastosVariosModo = "mantener" | "subir_pct" | "importe_fijo" | "criterio_ia";

interface AnalysisParams {
  pct_subida_global: number;          // 0 = criterio IA; 1-50 = % obligatorio
  gastos_varios_modo: GastosVariosModo;
  gastos_varios_valor: number;        // Solo aplica en "subir_pct" e "importe_fijo"
}
```

**Parámetros que el API route leerá del FormData:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `pct_subida_global` | number (string en FormData) | 0 = IA decide; >0 = % obligatorio |
| `gastos_varios_modo` | string | `mantener` / `subir_pct` / `importe_fijo` / `criterio_ia` |
| `gastos_varios_valor` | number (string en FormData) | Valor asociado al modo (% o €) |

### Instrucciones a inyectar en el SYSTEM_PROMPT (lógica condicional)

```
// Si pct_subida_global > 0:
"INSTRUCCIÓN OBLIGATORIA: Aplica una subida del {N}% a TODAS las partidas ordinarias
 (salvo las que tengan tratamiento especial indicado más abajo). No apliques un criterio
 distinto sin justificación explícita."

// Si gastos_varios_modo === "mantener":
"La partida 'Gastos varios' (o similar) DEBE mantenerse en el mismo importe del ejercicio anterior. No la modifiques."

// Si gastos_varios_modo === "subir_pct":
"La partida 'Gastos varios' (o similar) debe subir exactamente un {V}% respecto al gasto anterior."

// Si gastos_varios_modo === "importe_fijo":
"La partida 'Gastos varios' (o similar) debe fijarse en exactamente {V} € para el nuevo ejercicio."

// Si gastos_varios_modo === "criterio_ia":
(no se añade instrucción; la IA aplica su propio criterio como hasta ahora)
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Tipos y estado en el formulario UI

**Objetivo**: Añadir el tipo `AnalysisParams`, el estado correspondiente en `presupuestos-form.tsx`, y el panel visual de parámetros con los controles necesarios (input numérico de % global + selector de modo para gastos varios + input condicional de valor).

**Validación**: El panel aparece en la UI del formulario. Los controles son funcionales y el estado se actualiza correctamente. No hay errores de TypeScript.

### Fase 2: Envío de parámetros al API route

**Objetivo**: Modificar la función `analyze()` del formulario para añadir `pct_subida_global`, `gastos_varios_modo` y `gastos_varios_valor` al `FormData` antes de enviar la petición.

**Validación**: Al inspeccionar la petición POST en el navegador, los tres campos aparecen en el FormData junto a `liquidacion`, `cuotas` y `comunidad_codigo`.

### Fase 3: Construcción dinámica del SYSTEM_PROMPT en el API route

**Objetivo**: En `route.ts`, convertir `SYSTEM_PROMPT` de constante estática a función `buildSystemPrompt(params)` que lee los parámetros del `FormData` e inyecta las instrucciones condicionales descritas en el contexto.

**Validación**: El log del servidor muestra el prompt con las instrucciones correctas según los parámetros enviados. La IA devuelve un JSON donde las partidas ordinarias respetan el % global y "gastos varios" recibe el tratamiento configurado.

### Fase 4: Validación Final

**Objetivo**: Sistema funcionando end-to-end sin regresiones.

**Validación**:
- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run build` exitoso
- [ ] Flujo completo funciona: configurar parámetros → analizar → revisar → generar DOCX+PDF
- [ ] Con `pct_subida_global = 0` y `gastos_varios_modo = "criterio_ia"` el comportamiento es idéntico al actual (sin regresión)
- [ ] Con `pct_subida_global = 3` la IA aplica ~3% a las partidas ordinarias

---

## Aprendizajes (Self-Annealing)

> Esta sección CRECE con cada error encontrado durante la implementación.

_(Vacío — se completa durante la implementación)_

---

## Gotchas

- [ ] `FormData` solo transporta strings; hay que parsear `Number(form.get("pct_subida_global"))` en el API route con fallback a 0
- [ ] El `SYSTEM_PROMPT` debe seguir siendo la misma cadena estructurada; las instrucciones de parámetros se insertan en la sección "INSTRUCCIONES DE ANÁLISIS" para que la IA las procese con máxima prioridad
- [ ] El input de "valor" para gastos varios solo debe renderizarse cuando el modo es `subir_pct` o `importe_fijo` (condicional en UI)
- [ ] Validar en el API route que `pct_subida_global` esté en rango 0–50 antes de inyectarlo al prompt (evitar prompt injection)
- [ ] No persistir parámetros en BD ni en localStorage; son efímeros por análisis

## Anti-Patrones

- NO crear una nueva API route; reutilizar la existente `/api/documentos/presupuestos/analyze`
- NO añadir un state manager (Zustand) para estos parámetros; son locales al formulario
- NO ignorar errores de TypeScript en el tipo `GastosVariosModo`
- NO hardcodear los rangos de validación del % en el frontend sin replicarlos en el backend

---

*PRP pendiente aprobación. No se ha modificado código.*

# PRP-003: Control independiente de subida de cuotas de propietarios

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-03
> **Proyecto**: Panel gestión de fincas - Serincosol

---

## Objetivo

Añadir en el panel de parámetros del análisis de presupuestos un control independiente para que el administrador configure cuánto suben las cuotas que pagan los propietarios, separado de la subida de gastos ya existente (PRP-002). El resultado estimado del ejercicio debe reflejar ambas subidas (ingresos con cuotas nuevas vs. gastos nuevos) y mostrar el remanente/déficit esperado.

---

## Por Qué

| Problema | Solución |
|----------|----------|
| La subida de gastos y la subida de cuotas son decisiones independientes del administrador; mezclarlas no refleja la realidad | Parámetro separado para cuotas con sus propias modalidades (%, importe fijo, criterio IA) |
| El resultado estimado del ejercicio usa los ingresos con cuotas actuales (sin subida), dando una imagen incompleta | La IA calcula los ingresos también con la nueva cuota propuesta y muestra el remanente/déficit real esperado |
| Los coeficientes de cada tipo de finca se respetan automáticamente aplicando % sobre la cuota actual | La modalidad de % mantiene la proporcionalidad entre tipos sin esfuerzo manual |

**Valor de negocio**: El administrador puede simular escenarios reales de subida antes de llevar el presupuesto a junta. Un resultado estimado preciso (ingresos nuevos - gastos nuevos) da credibilidad al documento y evita revisiones manuales.

---

## Qué

### Criterios de Éxito

- [ ] El panel "Parámetros del análisis" incluye un nuevo bloque "Subida de cuotas" con selector de modalidad y valor
- [ ] Modalidades disponibles: `% sobre cuota actual`, `importe fijo igual para todos (+X€)`, `dejar a criterio IA`
- [ ] La instrucción sobre cuotas se inyecta en el `SYSTEM_PROMPT` de forma independiente a la de gastos
- [ ] El JSON devuelto por la IA calcula `subida_propuesta.por_tipo[].cuota_nueva` según la modalidad configurada
- [ ] El `resultado_estimado` en el JSON usa `ingresos` calculados con las cuotas nuevas (no las actuales)
- [ ] La UI de revisión muestra correctamente el resultado con ambas subidas reflejadas
- [ ] `npm run typecheck` y `npm run build` pasan sin errores
- [ ] El comportamiento sin configurar cuotas (modalidad "criterio IA") es idéntico al anterior (sin regresión)

### Comportamiento Esperado (Happy Path)

1. El usuario abre el formulario de presupuesto.
2. En el panel "Parámetros del análisis" configura:
   - **% subida global de gastos** (ya existe): p. ej. `3%`
   - **Subida de cuotas** (nuevo): elige `% sobre cuota actual` e introduce `3`
3. Pulsa "Analizar con IA".
4. El frontend añade `cuotas_subida_modo` y `cuotas_subida_valor` al `FormData`.
5. El API route construye el `SYSTEM_PROMPT` con una instrucción adicional:
   - Para `%`: "Aplica una subida del X% sobre cada cuota mensual actual. Respeta los coeficientes relativos entre tipos de finca."
   - Para importe fijo: "Añade exactamente X€ a la cuota mensual actual de cada tipo de finca."
   - Para criterio IA: (sin instrucción, la IA decide)
6. La IA devuelve el JSON con `subida_propuesta.por_tipo[].cuota_nueva` calculadas según la modalidad.
7. El `resultado_estimado.ingresos` refleja los ingresos anuales con las nuevas cuotas propuestas.
8. El usuario ve en la revisión el resultado estimado mostrando el remanente real esperado (ingresos nuevos - gastos nuevos).

---

## Contexto

### Referencias

- `src/app/api/documentos/presupuestos/analyze/route.ts` — Tiene `AnalysisParams` y `buildSystemPrompt()` ya dinámica. Aquí se añaden los nuevos campos.
- `src/app/dashboard/documentos/presupuestos/presupuestos-form.tsx` — Ya tiene el panel de parámetros (líneas 1035-1099) con `pctSubidaGlobal` y `gastosVariosModo/Valor`. Aquí se añade el bloque de cuotas.

### Arquitectura Propuesta

Sin cambios de BD. Cambios concentrados en los mismos dos archivos del PRP-002:

```
src/app/api/documentos/presupuestos/analyze/
└── route.ts
      ← Ampliar AnalysisParams con cuotas_subida_modo + cuotas_subida_valor
      ← buildSystemPrompt() añade bloque condicional de cuotas

src/app/dashboard/documentos/presupuestos/
└── presupuestos-form.tsx
      ← Nuevo estado: cuotasSubidaModo, cuotasSubidaValor
      ← Nuevo type: CuotasSubidaModo
      ← Nuevo bloque UI en el panel de parámetros
      ← analyze() añade los dos campos al FormData
```

### Modelo de Datos

Sin cambios en BD. Solo tipos TypeScript nuevos:

```typescript
type CuotasSubidaModo = "pct_cuota_actual" | "importe_fijo" | "criterio_ia";

// Ampliar AnalysisParams en route.ts:
interface AnalysisParams {
    pct_subida_global: number;
    gastos_varios_modo: "mantener" | "subir_pct" | "importe_fijo" | "criterio_ia";
    gastos_varios_valor: number;
    cuotas_subida_modo: CuotasSubidaModo;   // NUEVO
    cuotas_subida_valor: number;             // NUEVO (% o €)
}
```

**Campos nuevos en FormData:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `cuotas_subida_modo` | string | `pct_cuota_actual` / `importe_fijo` / `criterio_ia` |
| `cuotas_subida_valor` | number (string en FormData) | % de subida o €/mes a añadir por finca |

### Instrucciones a inyectar en el SYSTEM_PROMPT

```
// Si cuotas_subida_modo === "pct_cuota_actual" && cuotas_subida_valor > 0:
"INSTRUCCIÓN OBLIGATORIA — SUBIDA DE CUOTAS: Aplica una subida del {N}% sobre la cuota
 mensual actual de cada tipo de finca. Calcula la cuota nueva como cuota_actual × (1 + N/100),
 redondeando a dos decimales. Respeta la proporcionalidad relativa entre tipos de finca
 (los coeficientes se conservan automáticamente al aplicar el mismo % a todas).
 Usa estas cuotas nuevas para calcular los ingresos anuales en resultado_estimado.ingresos."

// Si cuotas_subida_modo === "importe_fijo" && cuotas_subida_valor > 0:
"INSTRUCCIÓN OBLIGATORIA — SUBIDA DE CUOTAS: Añade exactamente {N}€ a la cuota mensual
 actual de cada tipo de finca (el mismo importe fijo para todos los tipos).
 Usa estas cuotas nuevas para calcular los ingresos anuales en resultado_estimado.ingresos."

// Si cuotas_subida_modo === "criterio_ia":
(sin instrucción; la IA propone la subida de cuotas con su criterio habitual)
```

### Impacto en el JSON de salida

El campo `resultado_estimado` del JSON ya existe con `ingresos`, `gastos` y `resultado`. Con esta feature:
- Cuando hay instrucción de subida de cuotas, la IA debe usar los **ingresos calculados con cuotas nuevas** en `resultado_estimado.ingresos` (no con las cuotas actuales como hasta ahora).
- `cuotas_actuales[].cuota_mensual` sigue mostrando las cuotas actuales sin modificar.
- `subida_propuesta.por_tipo[].cuota_nueva` refleja la cuota nueva según la instrucción.
- El `recompute()` del frontend (líneas 239-298 del formulario) ya recalcula `resultado_estimado` a partir de `cuotas_actuales` (cuotas sin subir). Para mostrar el resultado con cuotas nuevas, se necesita que la IA calcule `ingresos` usando `subida_propuesta.por_tipo` en lugar de `cuotas_actuales`. La instrucción al prompt debe ser explícita en este punto.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase.

### Fase 1: Tipos y estado en el formulario UI

**Objetivo**: Añadir el type `CuotasSubidaModo`, los estados `cuotasSubidaModo` y `cuotasSubidaValor` en `presupuestos-form.tsx`, y el nuevo bloque visual "Subida de cuotas" en el panel de parámetros. El bloque tendrá selector de modalidad e input condicional de valor (igual al patrón de gastos varios ya existente).

**Validación**: El panel de parámetros muestra el nuevo bloque. El selector y el input son funcionales. No hay errores de TypeScript.

### Fase 2: Envío de parámetros al API route

**Objetivo**: Modificar la función `analyze()` para añadir `cuotas_subida_modo` y `cuotas_subida_valor` al `FormData` antes del envío.

**Validación**: Los dos campos nuevos viajan en la petición POST junto a los ya existentes.

### Fase 3: Construcción dinámica del SYSTEM_PROMPT (cuotas)

**Objetivo**: Ampliar `AnalysisParams` en `route.ts` con los dos nuevos campos. Leerlos del `FormData` con validación. Añadir en `buildSystemPrompt()` el bloque condicional de instrucciones de cuotas, que se inyecta junto al bloque de gastos ya existente.

**Validación**: El prompt generado incluye la instrucción correcta según los parámetros. Con `criterio_ia` no se añade instrucción (sin regresión).

### Fase 4: Resultado estimado con ingresos nuevos

**Objetivo**: Asegurar que la instrucción al prompt especifica explícitamente que `resultado_estimado.ingresos` debe calcularse usando las cuotas nuevas propuestas (no las actuales) cuando hay una instrucción de subida de cuotas. Verificar que la sección "3. Resultado estimado del ejercicio" en la UI refleja los valores correctos.

**Validación**: Con subida del 3% en cuotas, los ingresos del resultado estimado son ~3% superiores a los de cuotas actuales. El remanente/déficit es coherente con esa diferencia.

### Fase 5: Validación Final

**Objetivo**: Sistema funcionando end-to-end con ambas subidas (gastos + cuotas) coordinadas.

**Validación**:
- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run build` exitoso
- [ ] Flujo completo funciona: configurar parámetros (gastos + cuotas) → analizar → revisar → generar DOCX+PDF
- [ ] Modalidad `criterio_ia` en cuotas: comportamiento idéntico al anterior (sin regresión)
- [ ] Modalidad `pct_cuota_actual` con 3%: `cuota_nueva` = cuota_actual × 1.03 y `resultado_estimado.ingresos` usa esa cuota nueva
- [ ] Modalidad `importe_fijo` con 5€: `cuota_nueva` = cuota_actual + 5 para todos los tipos
- [ ] El resultado estimado muestra el remanente/déficit correcto: ingresos con cuotas nuevas - gastos presupuestados

---

## Aprendizajes (Self-Annealing)

> Esta sección CRECE con cada error encontrado durante la implementación.

_(Vacío — se completa durante la implementación)_

---

## Gotchas

- [ ] `recompute()` en el frontend recalcula `resultado_estimado.ingresos` usando `cuotas_actuales[].cuota_mensual` (las cuotas sin subida). Si el usuario edita manualmente en la pantalla de revisión, el recálculo borrará los ingresos con cuotas nuevas que devolvió la IA. Solución: dejar `recompute()` como está (trabaja con datos del formulario) y documentar que el `resultado_estimado` inicial viene de la IA con las cuotas nuevas, mientras que la edición manual recalcula sobre cuotas actuales. No rompe el flujo habitual.
- [ ] La instrucción al prompt debe indicar explícitamente en qué campo del JSON colocar los ingresos con cuotas nuevas (`resultado_estimado.ingresos`), o la IA podría mezclar los dos valores.
- [ ] El campo `ingresos_previstos_anual` del JSON sigue representando los ingresos con cuotas actuales (ya que sirve para la tabla de cuotas actuales). El `resultado_estimado.ingresos` es el que debe usar cuotas nuevas cuando hay instrucción.
- [ ] Validar en el API route que `cuotas_subida_valor` >= 0 y `cuotas_subida_modo` sea uno de los valores válidos (igual que se hace con los parámetros de gastos).
- [ ] No persistir en BD ni localStorage; efímero por análisis.

## Anti-Patrones

- NO reutilizar `pct_subida_global` para la subida de cuotas; son conceptos independientes (gastos vs. ingresos)
- NO añadir un modal separado; el bloque va en el mismo panel de parámetros ya existente
- NO cambiar el JSON de salida de la IA (mismos campos); solo cambiar qué valor lleva `resultado_estimado.ingresos`
- NO ignorar el caso en que `cuotas_subida_modo === "criterio_ia"` ya hace algo razonable (la instrucción 9 del prompt actual ya pide `cuota_nueva`)

---

*PRP pendiente aprobación. No se ha modificado código.*

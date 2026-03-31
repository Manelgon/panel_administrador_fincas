---
name: sprint
description: "Ejecutar tareas rapidas sin planificacion formal. Activar cuando la tarea se resuelve en minutos, afecta 1-3 archivos, y el resultado es verificable de inmediato. Ejemplos: arregla un boton, cambia un color, agrega un campo, corrige un typo, ajusta un componente."
---

# Modo SPRINT del Bucle Agentico

> "No pienses. Ejecuta. Itera. Confirma."

El modo SPRINT es para tareas que no requieren planificacion formal. Ejecucion directa con MCPs on-demand.

---

## Cuando Usar SPRINT

- La tarea se puede describir en una oracion
- Afecta 1-3 archivos maximo
- No requiere cambios estructurales en base de datos
- No tiene dependencias complejas entre componentes
- El resultado es verificable inmediatamente

### Ejemplos

```
"El boton de login no funciona"
"Anade un campo de telefono al formulario"
"Cambia el color del header a azul"
"El query de usuarios esta lento"
"Anade validacion de email"
"El componente no se renderiza en mobile"
```

---

## El Flujo SPRINT

```
+------------------------------------------+
|           RECIBIR TAREA                   |
+------------------------------------------+
                  |
+------------------------------------------+
|         EJECUTAR DIRECTAMENTE            |
|                                          |
|  - Leer archivos relevantes             |
|  - Implementar solucion                 |
|  - NO crear plan formal                 |
|  - NO usar TodoWrite                    |
+------------------------------------------+
                  |
+------------------------------------------+
|      MCPs ON-DEMAND (si necesita)        |
|                                          |
|  Next.js MCP -> Ver errores              |
|  Playwright -> Validar visual            |
|  Supabase -> Consultar/modificar DB      |
+------------------------------------------+
                  |
+------------------------------------------+
|        ITERAR HASTA COMPLETAR            |
|                                          |
|  IF error detectado:                     |
|    -> Corregir                           |
|    -> Verificar de nuevo                 |
|  ELSE:                                   |
|    -> Pasar a confirmar                  |
+------------------------------------------+
                  |
+------------------------------------------+
|         CONFIRMAR RESULTADO              |
|                                          |
|  - Mostrar que se hizo                   |
|  - Explicar brevemente el cambio         |
|  - Preguntar si necesita ajustes         |
+------------------------------------------+
```

---

## Uso de MCPs en SPRINT

Los MCPs son **herramientas disponibles**, no pasos obligatorios. El agente decide **dinamicamente** cuando usarlos.

### Next.js DevTools MCP

**Usar cuando:**
- Hay un error y no esta claro que lo causa
- Necesito verificar que no hay errores de tipos
- Quiero ver el estado del servidor de desarrollo

**NO usar cuando:**
- El cambio es puramente visual
- Ya se exactamente que esta mal

### Playwright MCP

**Usar cuando:**
- Necesito verificar como se ve algo visualmente
- El usuario reporto un problema visual
- Quiero confirmar que un componente renderiza correctamente

**NO usar cuando:**
- El cambio es en logica backend
- Es un fix de tipos sin impacto visual

### Supabase MCP

**Usar cuando:**
- Necesito ver la estructura actual de una tabla
- Quiero verificar que un query funciona
- Necesito ver logs de auth o postgres

**NO usar cuando:**
- El cambio no involucra base de datos
- Ya conozco la estructura de los datos

---

## Ejemplo Completo SPRINT

### Tarea

```
Usuario: "El boton de login no funciona, se queda cargando infinitamente"
```

### Ejecucion

```
1. LEO el componente LoginButton.tsx
   -> Veo que hace fetch a /api/auth/login

2. LEO la ruta /api/auth/login
   -> Parece correcta, pero veo que usa await sin try/catch

3. [Next.js MCP] -> get_errors
   -> "Unhandled promise rejection in /api/auth/login"

4. CORRIJO anadiendo try/catch con manejo de error

5. [Next.js MCP] -> get_errors
   -> Sin errores

6. [Playwright MCP] -> screenshot de /login
   -> Boton funciona, muestra loading y luego redirige

7. CONFIRMO:
   "Listo. El problema era que el endpoint de login no tenia
   manejo de errores. Cuando Supabase fallaba, la promesa
   quedaba sin resolver. Anadi try/catch y ahora muestra
   el error correctamente si falla, o redirige si tiene exito."
```

**Tiempo total: ~2 minutos**

---

## Cuando NO Usar SPRINT

Si la tarea cumple alguna de estas condiciones, usar **BLUEPRINT** (`/bucle-agentico`):

- Requiere crear multiples componentes nuevos
- Necesita cambios en esquema de base de datos
- Tiene dependencias entre varias partes
- Es una feature completa end-to-end
- Requiere entender contexto amplio antes de implementar

---

## Principios SPRINT

1. **Sin overhead**: No crear fases, planes, ni TodoWrite
2. **MCPs on-demand**: Usar solo cuando el juicio lo indique
3. **Iteracion pura**: Codigo -> Error -> Fix -> Repeat
4. **Velocidad maxima**: Cada token cuenta
5. **Confirmacion clara**: Siempre explicar que se hizo

---

*"No pienses de mas. Ejecuta, observa, ajusta."*

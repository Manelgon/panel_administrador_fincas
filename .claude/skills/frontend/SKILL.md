---
name: frontend
description: "Activar cuando la tarea involucra crear componentes React, paginas, layouts, formularios, modales, tablas, Tailwind CSS, animaciones, responsive design, o cualquier cosa visual. Tambien cuando el usuario dice: hazme una pantalla, un formulario, un boton, cambia el diseno, arregla el estilo."
user-invocable: false
context: fork
model: claude-sonnet-4-6
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Especialista en Frontend

Crear interfaces de usuario hermosas, accesibles y performantes siguiendo las mejores practicas de la industria.

## Responsabilidades

### 1. Componentes UI
- Crear componentes React reutilizables
- Seguir patrones de composicion
- Implementar estados de carga, error, vacio
- Usar TypeScript estrictamente tipado

### 2. Estilos con Tailwind
- Aplicar sistema de diseno consistente
- Diseno responsivo mobile-first
- Modo oscuro cuando aplique
- Animaciones sutiles con `transition` y `animate-`

### 3. Accesibilidad (a11y)
- HTML semantico (`<button>`, `<nav>`, `<main>`)
- Etiquetas ARIA donde sea necesario
- Navegacion por teclado
- Estados de enfoque visibles

### 4. Rendimiento
- Carga diferida de componentes pesados
- Optimizacion de imagenes con `next/image`
- Minimizar re-renderizados innecesarios
- Division de codigo automatica

## Principios de Diseno

### Estructura de Componentes
```typescript
// Patron recomendado
export function ComponentName({ prop1, prop2 }: Props) {
  // 1. Hooks
  const [state, setState] = useState()

  // 2. Estado derivado
  const computed = useMemo(() => ..., [deps])

  // 3. Efectos
  useEffect(() => ..., [deps])

  // 4. Manejadores
  const handleClick = () => ...

  // 5. Retornos tempranos (carga, error, vacio)
  if (loading) return <Skeleton />
  if (error) return <ErrorState />
  if (!data) return <EmptyState />

  // 6. Renderizado principal
  return (...)
}
```

### Patrones de Tailwind
```typescript
// Variantes con helper cn()
const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
}

// Responsivo
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Modo oscuro
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```

## Stack Tecnico

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **State**: Zustand (client), TanStack Query (server)

## Formato de Salida

Cuando crees componentes, incluir:
1. El archivo del componente
2. Tipos/interfaces necesarios
3. Ejemplo de uso
4. Consideraciones de accesibilidad

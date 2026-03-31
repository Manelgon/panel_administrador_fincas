# MEMORY.md — Panel María José Martos de Dios

## Decisiones de Arquitectura

- **Un solo Supabase**: Se unificó a un único proyecto Supabase (eliminando el secundario). Todas las tablas (`incidencias`, `incidencias_serincobot`, `propietarios`, `morosidad`, `comunidades`, etc.) conviven en el mismo proyecto.
- **Tablas separadas (no fusionar)**: `incidencias` e `incidencias_serincobot` se mantienen como tablas independientes a petición del usuario.
- **Next.js 16 + App Router + Turbopack**: Stack base del proyecto.
- **Tailwind CSS + Lucide React**: Sistema de estilos y librería de iconos principal.
- **Modo claro fijo**: No hay dark mode implementado actualmente. La paleta es neutra (bg-neutral-950 sidebar, bg-white contenido).

## Preferencias del Usuario

- **Idioma**: Interfaz 100% en español.
- **Estilo visual**: Minimalista, profesional. Uso de amarillo (#FACC15 / yellow-400) como color primario de acento, negro (neutral-900/950) como secundario.
- **PDFs**: Se generan reportes en PDF nativos usando `pdf-lib` (sin dependencias de navegador).
- **Webhooks**: Se disparan webhooks a `serinwebhook.afcademia.com` para nuevos tickets y deudas. También existe un webhook para tickets resueltos.
- **Validación**: Se ha adoptado Zod en `src/lib/schemas.ts` para validar los formularios de incidencias, deudas y comunidades.

## Patrones de Código

- **`logActivity()`**: Toda acción CRUD se registra con `logActivity()` desde `@/lib/logActivity`.
- **Real-time**: Se usan canales de Supabase (`postgres_changes`) para escuchar cambios en `incidencias`, `morosidad`, etc.
- **Tipos compartidos**: `src/lib/schemas.ts` contiene interfaces (`Incidencia`, `Morosidad`, `Comunidad`, `Profile`, `ComunidadOption`, `DeleteCredentials`) y schemas Zod.
- **Scroll lock en modales**: `document.body.style.overflow = 'hidden'` al abrir modales.
- **Cronometraje integrado**: El Navbar muestra temporizadores activos (fichaje y tarea) con posibilidad de iniciar/parar desde cualquier pantalla.
- **DataTable genérico**: Componente reutilizable `<DataTable>` con columnas configurables, selección múltiple, y persistencia de columnas visibles en localStorage.
- **DeleteConfirmationModal**: Modal reutilizable que exige email + password de admin para eliminar registros.

## Estructura de Carpetas Clave

```
src/
├── app/dashboard/          # Páginas principales (incidencias, deudas, comunidades, sofia, ...)
├── components/             # Componentes reutilizables (KPICard, DataTable, Navbar, Sidebar, ...)
├── hooks/                  # Custom hooks (useDashboardData)
├── lib/                    # Utilidades (supabaseClient, schemas, logActivity, storage, pdf/*)
└── app/api/                # API routes (export, webhooks, storage, admin)
```

## Notas Importantes

- Las variables de entorno del Supabase secundario fueron eliminadas de `.env.local`.
- Los archivos `supabaseSecondaryClient.ts` y `supabaseAdminSecondary.ts` fueron eliminados.
- El script de migración `migrations/001_complete_schema.sql` está actualizado pero pendiente de ejecutar en Supabase.

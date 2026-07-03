import { NextResponse } from 'next/server';
import { supabaseRouteClient } from '@/lib/supabase/route';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type AuthResult =
  | { success: true; userId: string; rol: string | null }
  | { success: false; response: NextResponse };

/**
 * Verifica que la petición viene de un usuario con sesión válida.
 * La sesión se lee de la cookie (las llamadas desde el panel la incluyen
 * automáticamente al usar fetch con ruta relativa).
 *
 * Uso al inicio de un route handler:
 *   const auth = await requireAuth();
 *   if (!auth.success) return auth.response;
 *   // auth.userId, auth.rol disponibles
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await supabaseRouteClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      success: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  // Rol desde profiles (service_role para no depender de RLS)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('rol, activo')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile || profile.activo === false) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Cuenta inactiva' }, { status: 403 }),
    };
  }

  return { success: true, userId: user.id, rol: profile.rol ?? null };
}

/**
 * Como requireAuth, pero además exige rol 'admin'.
 * Ignora cualquier adminId/userId que venga del cliente: el rol se
 * comprueba sobre el usuario autenticado en la sesión.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireAuth();
  if (!auth.success) return auth;

  if (auth.rol !== 'admin') {
    return {
      success: false,
      response: NextResponse.json({ error: 'Se requiere rol de administrador' }, { status: 403 }),
    };
  }

  return auth;
}

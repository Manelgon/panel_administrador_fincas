import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // 1. Create Supabase client
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    // 2. Refresh session
    const { data: { user } } = await supabase.auth.getUser()

    // 3. Define protected/auth routes
    const path = request.nextUrl.pathname
    const isAuthRoute = path.startsWith('/auth')
    const isDashboardRoute = path.startsWith('/dashboard') || path === '/'

    // 4. Handle redirects
    if (isDashboardRoute && !user) {
        // Redirect to login if accessing dashboard without user
        return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    if (isAuthRoute && user) {
        // Redirect to dashboard if accessing login while logged in
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // 5. If user is authenticated and accessing a dashboard route,
    //    verify they have an active profile in public.profiles.
    //    This prevents users who exist in auth.users but NOT in profiles
    //    from accessing the panel (e.g. created manually without the trigger).
    if (isDashboardRoute && user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, activo')
            .eq('user_id', user.id)
            .maybeSingle()

        if (!profile || !profile.activo) {
            // Sign out the session and redirect to login
            await supabase.auth.signOut()
            return NextResponse.redirect(new URL('/auth/login', request.url))
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api (API routes - generally you want to protect these too, but maybe differently)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

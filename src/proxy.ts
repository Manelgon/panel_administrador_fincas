import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    // Let Next.js handle Server Actions internally
    if (request.headers.has('next-action')) {
        return NextResponse.next()
    }

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
                    request.cookies.set({ name, value, ...options })
                    response = NextResponse.next({ request: { headers: request.headers } })
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({ request: { headers: request.headers } })
                    response.cookies.set({ name, value: '', ...options })
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
        return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    if (isAuthRoute && user) {
        // Skip redirect if cookies are being cleared after a forced sign-out
        const justLoggedOut = request.nextUrl.searchParams.get('logged_out') === '1'
        const forceSignout = request.nextUrl.searchParams.get('force_signout') === '1'
        if (!justLoggedOut && !forceSignout) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    // 5. Verify active profile for dashboard routes
    if (isDashboardRoute && user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, activo')
            .eq('user_id', user.id)
            .maybeSingle()

        if (!profile || !profile.activo) {
            // Do NOT call signOut() here — it doesn't clear cookies reliably in proxy.
            // Redirect to login with force_signout=1 so the login page handles it.
            const loginUrl = new URL('/auth/login', request.url)
            loginUrl.searchParams.set('force_signout', '1')
            const redirectResponse = NextResponse.redirect(loginUrl)
            // Manually clear Supabase session cookies
            for (const cookie of request.cookies.getAll()) {
                if (cookie.name.startsWith('sb-')) {
                    redirectResponse.cookies.delete(cookie.name)
                }
            }
            return redirectResponse
        }
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, LogIn, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);

    // Load remembered credentials on mount
    useEffect(() => {
        const saved = localStorage.getItem('remembered_credentials');
        if (saved) {
            try {
                const { email: savedEmail, password: savedPassword, timestamp } = JSON.parse(saved);
                const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                if (Date.now() - timestamp < thirtyDays) {
                    setEmail(savedEmail);
                    setPassword(savedPassword);
                    setRememberMe(true);
                } else {
                    localStorage.removeItem('remembered_credentials');
                }
            } catch {
                localStorage.removeItem('remembered_credentials');
            }
        }
    }, []);

    useEffect(() => {
        if (!rememberMe) {
            localStorage.removeItem('remembered_credentials');
        }
    }, [rememberMe]);

    const handleLogin = async (e: SubmitEvent | React.SyntheticEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                toast.error('Credenciales incorrectas');
                setLoading(false);
                return;
            }

            // ── VERIFICAR QUE EXISTE UN PERFIL ──────────────────────────────────
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('user_id, activo')
                .eq('user_id', authData.user.id)
                .maybeSingle();

            if (profileError || !profile) {
                await supabase.auth.signOut();
                toast.error(
                    'Tu cuenta no tiene un perfil asignado. Contacta con el administrador.',
                    { duration: 6000 }
                );
                setLoading(false);
                return;
            }

            if (!profile.activo) {
                await supabase.auth.signOut();
                toast.error(
                    'Tu cuenta está desactivada. Contacta con el administrador.',
                    { duration: 6000 }
                );
                setLoading(false);
                return;
            }
            // ────────────────────────────────────────────────────────────────────

            if (rememberMe) {
                localStorage.setItem('remembered_credentials', JSON.stringify({
                    email, password, timestamp: Date.now()
                }));
                await supabase.auth.updateUser({ data: { remember_me: true } });
            } else {
                localStorage.removeItem('remembered_credentials');
            }

            // Overlay se mantiene visible durante la navegación al dashboard
            toast.success('Bienvenido');
            router.push('/dashboard');
        } catch {
            toast.error('Ocurrió un error inesperado');
            setLoading(false);
        }
    };

    return (
        <>
        {loading && createPortal(
            <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md">
                <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-yellow-400/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    <LogIn className="absolute inset-0 m-auto w-10 h-10 text-yellow-400 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">Iniciando sesión</h3>
                    <p className="text-neutral-400 text-sm">Verificando credenciales...</p>
                </div>
            </div>,
            document.body
        )}
        <div
            className="relative rounded-2xl p-8"
            style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 60px -10px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
            }}
        >
            {/* Logo */}
            <div className="mb-8 text-center">
                <div className="flex justify-center mb-5">
                    <div
                        className="p-3 rounded-2xl"
                        style={{
                            background: 'rgba(251,191,36,0.10)',
                            border: '1px solid rgba(251,191,36,0.25)',
                        }}
                    >
                        <img
                            src="/serincosol-logo.png"
                            alt="Serincosol Logo"
                            className="h-14 w-auto object-contain"
                        />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Iniciar Sesión
                </h1>
                <p className="text-sm mt-1.5 text-gray-500">
                    Panel de administración Serincosol
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
                {/* Email */}
                <div>
                    <label
                        htmlFor="email"
                        className="block text-xs font-semibold mb-1.5 text-gray-600 uppercase tracking-wide"
                    >
                        Email
                    </label>
                    <div className="relative">
                        <Mail
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
                            aria-hidden="true"
                        />
                        <input
                            id="email"
                            type="email"
                            required
                            autoComplete="email"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-gray-900 placeholder-gray-400 transition-all outline-none"
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
                            }}
                            onFocus={e => {
                                e.currentTarget.style.border = '1px solid #fbbf24';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.15), inset 0 1px 2px rgba(0,0,0,0.04)';
                            }}
                            onBlur={e => {
                                e.currentTarget.style.border = '1px solid #e2e8f0';
                                e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)';
                            }}
                            placeholder="usuario@serincosol.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                {/* Password */}
                <div>
                    <label
                        htmlFor="password"
                        className="block text-xs font-semibold mb-1.5 text-gray-600 uppercase tracking-wide"
                    >
                        Contraseña
                    </label>
                    <div className="relative">
                        <Lock
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
                            aria-hidden="true"
                        />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm text-gray-900 placeholder-gray-400 transition-all outline-none"
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
                            }}
                            onFocus={e => {
                                e.currentTarget.style.border = '1px solid #fbbf24';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.15), inset 0 1px 2px rgba(0,0,0,0.04)';
                            }}
                            onBlur={e => {
                                e.currentTarget.style.border = '1px solid #e2e8f0';
                                e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)';
                            }}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                            {showPassword
                                ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                                : <Eye className="w-4 h-4" aria-hidden="true" />
                            }
                        </button>
                    </div>
                </div>

                {/* Remember me */}
                <div className="flex items-center gap-2.5">
                    <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded cursor-pointer appearance-none transition-all"
                        style={{
                            background: rememberMe ? '#fbbf24' : '#f8fafc',
                            border: `1px solid ${rememberMe ? '#fbbf24' : '#d1d5db'}`,
                            boxShadow: rememberMe ? '0 0 0 3px rgba(251,191,36,0.20)' : 'none',
                            backgroundImage: rememberMe
                                ? `url("data:image/svg+xml,%3Csvg viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4l3 3 5-6' stroke='%23fff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`
                                : 'none',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundSize: '10px 8px',
                        }}
                    />
                    <label
                        htmlFor="rememberMe"
                        className="text-sm cursor-pointer select-none text-gray-600"
                    >
                        Recuérdame
                    </label>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        background: loading ? '#f59e0b' : '#fbbf24',
                        color: '#1c1917',
                        boxShadow: loading ? 'none' : '0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(251,191,36,0.35)',
                    }}
                    onMouseEnter={e => {
                        if (!loading) {
                            (e.currentTarget as HTMLElement).style.background = '#f59e0b';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.15), 0 6px 24px rgba(251,191,36,0.45)';
                        }
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = '#fbbf24';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(251,191,36,0.35)';
                    }}
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-amber-900/20 border-t-amber-900/60 rounded-full animate-spin" aria-hidden="true" />
                            Entrando...
                        </>
                    ) : (
                        <>
                            <LogIn className="w-4 h-4" aria-hidden="true" />
                            Entrar
                        </>
                    )}
                </button>
            </form>

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-gray-400">
                ¿Sin acceso?{' '}
                <span
                    className="cursor-default text-amber-500"
                    title="Contacta con el administrador"
                >
                    Contacta con soporte
                </span>
            </p>
        </div>
        </>
    );
}

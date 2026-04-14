'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home, Building, AlertCircle, FileText, LogOut, Activity,
    Users, Clock, X, Folder, Timer, ChevronRight, CalendarDays
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NotificationsBell from '@/components/NotificationsBell';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const SECTIONS = [
    {
        label: 'GESTIÓN',
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: Home },
            { name: 'Comunidades', href: '/dashboard/comunidades', icon: Building },
            { name: 'Proveedores', href: '/dashboard/proveedores', icon: Users },
            { name: 'Tickets', href: '/dashboard/incidencias', icon: AlertCircle },
            { name: 'Deudas', href: '/dashboard/deudas', icon: Activity },
            { name: 'Crono. Tareas', href: '/dashboard/cronometraje', icon: Timer },
        ],
    },
    {
        label: 'DOCUMENTACIÓN',
        items: [
            { name: 'Documentos', href: '/dashboard/documentos', icon: FileText },
            { name: 'Reuniones y Actas', href: '/dashboard/reuniones', icon: CalendarDays },
            { name: 'Informe Comunidad', href: '/dashboard/informes-comunidad', icon: Building },
        ],
    },
    {
        label: 'OPERACIONES',
        items: [
            { name: 'Fichaje y Vacaciones', href: '/dashboard/fichaje', icon: Clock },
            { name: 'Avisos', href: '/dashboard/avisos', icon: AlertCircle },
        ],
    },
];

const ADMIN_SECTION = {
    label: 'ADMINISTRACIÓN',
    items: [
        { name: 'Actividad', href: '/dashboard/actividad', icon: Activity },
        { name: 'Perfiles', href: '/dashboard/perfiles', icon: Users },
        { name: 'Control Horario', href: '/dashboard/fichaje/admin', icon: Clock },
        { name: 'Ajustes Emisor', href: '/dashboard/ajustes-emisor', icon: Building },
    ],
};

const LOCAL_SECTION = {
    label: 'LOCAL',
    items: [
        { name: 'Sofia (Local)', href: '/dashboard/sofia', icon: AlertCircle },
        { name: 'Propietarios Sofia', href: '/dashboard/propietarios-sofia', icon: Users },
        { name: 'Facturas', href: '/dashboard/facturas-comunidades', icon: Folder },
    ],
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const [isAdmin, setIsAdmin] = useState(false);
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [isLocal, setIsLocal] = useState(false);
    const [companyName, setCompanyName] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsLocal(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        }
        const checkRole = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserEmail(session.user.email || '');
                const { data } = await supabase
                    .from('profiles')
                    .select('rol, nombre, apellido')
                    .eq('user_id', session.user.id)
                    .single();
                if (data) {
                    setUserName([data.nombre, data.apellido].filter(Boolean).join(' ') || session.user.user_metadata?.nombre || '');
                    if (data.rol === 'admin') setIsAdmin(true);
                }
            }
        };
        const loadCompanyName = async () => {
            const { data } = await supabase
                .from('company_settings')
                .select('setting_key, setting_value')
                .eq('setting_key', 'emisor_name')
                .single();
            if (data?.setting_value) setCompanyName(data.setting_value);
        };
        checkRole();
        loadCompanyName();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/auth/login';
    };

    const initials = userName
        ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : userEmail?.[0]?.toUpperCase() ?? '?';

    const allSections = [
        ...SECTIONS,
        ...(isAdmin ? [ADMIN_SECTION] : []),
        ...(isLocal ? [LOCAL_SECTION] : []),
    ];

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 md:hidden"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed md:static inset-y-0 right-0 md:left-0 z-50
                    w-64 shrink-0 h-full md:min-h-screen flex flex-col overflow-y-auto
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                `}
                style={{
                    background: 'rgba(12,10,9,0.92)',
                    backdropFilter: 'blur(32px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(32px) saturate(160%)',
                    borderRight: '1px solid rgba(255,255,255,0.07)',
                }}
                aria-label="Navegación principal"
            >
                {/* Header */}
                <div
                    className="px-4 py-4 flex items-center justify-between flex-shrink-0"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ background: '#fbbf24' }}
                            aria-hidden="true"
                        />
                        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#fbbf24' }}>
                            {companyName || 'Serincosol'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="md:block hidden">
                            <NotificationsBell align="left" />
                        </div>
                        <button
                            onClick={onClose}
                            className="md:hidden p-1.5 rounded-lg transition-colors"
                            style={{ color: 'rgba(255,255,255,0.5)' }}
                            aria-label="Cerrar menú"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* User card */}
                <div
                    className="mx-3 my-3 px-3 py-2.5 rounded-xl flex items-center gap-3 flex-shrink-0"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-neutral-950 flex-shrink-0"
                        style={{ background: '#fbbf24' }}
                        aria-hidden="true"
                    >
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        {userName && <p className="text-xs font-semibold text-white truncate">{userName}</p>}
                        {userEmail && <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{userEmail}</p>}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-lg transition-all flex-shrink-0"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(251,191,36,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Cerrar sesión"
                        aria-label="Cerrar sesión"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 py-1 overflow-y-auto custom-scrollbar" aria-label="Menú de navegación">
                    {allSections.map((section) => (
                        <div key={section.label} className="mb-3">
                            <p
                                className="px-3 pb-1 text-[9px] font-bold tracking-widest"
                                style={{ color: 'rgba(255,255,255,0.25)' }}
                            >
                                {section.label}
                            </p>
                            {section.items.map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={onClose}
                                        aria-current={isActive ? 'page' : undefined}
                                        className="group flex items-center gap-3 rounded-lg px-3 py-2 mb-0.5 text-sm font-medium transition-all duration-150"
                                        style={isActive ? {
                                            background: 'rgba(251,191,36,0.12)',
                                            borderLeft: '3px solid #fbbf24',
                                            color: '#fbbf24',
                                            paddingLeft: '9px',
                                        } : {
                                            borderLeft: '3px solid transparent',
                                            color: 'rgba(255,255,255,0.5)',
                                        }}
                                        onMouseEnter={e => {
                                            if (!isActive) {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isActive) {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                                            }
                                        }}
                                    >
                                        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                                        <span className="truncate flex-1">{item.name}</span>
                                        {isActive && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" aria-hidden="true" />}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>
            </aside>
        </>
    );
}

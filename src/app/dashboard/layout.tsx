'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { Menu } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { GlobalLoadingProvider } from '@/lib/globalLoading';

function Greeting() {
    const [name, setName] = useState('');
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 14) setGreeting('Buenos días');
        else if (hour >= 14 && hour < 21) setGreeting('Buenas tardes');
        else setGreeting('Buenas noches');

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session?.user) return;
            supabase
                .from('profiles')
                .select('nombre')
                .eq('user_id', session.user.id)
                .single()
                .then(({ data }) => {
                    if (data?.nombre) setName(data.nombre);
                });
        });
    }, []);

    if (!greeting) return null;

    return (
        <div className="flex flex-col leading-tight">
            <span className="text-[10px] text-neutral-400 font-medium">{greeting},</span>
            <span className="text-sm font-bold text-neutral-800 truncate max-w-[180px]">{name || '–'}</span>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <GlobalLoadingProvider>
        <div className="h-screen overflow-hidden flex bg-neutral-100">
            {/* Sidebar — dark, stays as liquid glass */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main content area — light */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Navbar bar */}
                <header className="flex-shrink-0 bg-white border-b border-neutral-200">
                    <div className="flex items-center gap-4 px-4 md:px-6 py-3">
                        <Greeting />
                        <div className="flex-1">
                            <Navbar />
                        </div>
                        {/* Hamburger — mobile only */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                            aria-label="Abrir menú"
                        >
                            <Menu className="w-5 h-5 text-neutral-700" />
                        </button>
                    </div>
                </header>

                {/* Scrollable page content */}
                <main
                    className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6"
                    id="main-content"
                >
                    {children}
                </main>
            </div>
        </div>
        </GlobalLoadingProvider>
    );
}

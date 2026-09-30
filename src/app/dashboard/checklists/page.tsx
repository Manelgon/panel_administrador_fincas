'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ChecklistsTab, { ChecklistsPreselect } from './ChecklistsTab';
import PlantillasTab from './PlantillasTab';
import CategoriasTab from './CategoriasTab';

type Tab = 'checklists' | 'plantillas' | 'categorias';
const TABS: Tab[] = ['checklists', 'plantillas', 'categorias'];

export default function ChecklistsPage() {
    return (
        <Suspense>
            <Contenido />
        </Suspense>
    );
}

function Contenido() {
    // Deep-link: /dashboard/checklists?tab=plantillas|categorias  o  ?comunidad_id=X (&new=1)
    const params = useSearchParams();
    const [activeTab, setActiveTab] = useState<Tab>(TABS.find(t => t === params.get('tab')) ?? 'checklists');
    const preselect = useMemo<ChecklistsPreselect | undefined>(() => {
        const comunidadId = params.get('comunidad_id');
        const openForm = params.get('new') === '1';
        if (!comunidadId && !openForm) return undefined;
        return { comunidadId: comunidadId ? Number(comunidadId) : undefined, openForm };
    }, [params]);

    const tabClass = (tab: Tab) =>
        `px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${activeTab === tab
            ? 'border-yellow-400 text-neutral-900'
            : 'border-transparent text-neutral-400 hover:text-neutral-700'}`;

    return (
        <div className="space-y-6">
            <div className="flex gap-1 border-b border-neutral-200">
                <button className={tabClass('checklists')} onClick={() => setActiveTab('checklists')}>Checklists</button>
                <button className={tabClass('plantillas')} onClick={() => setActiveTab('plantillas')}>Plantillas</button>
                <button className={tabClass('categorias')} onClick={() => setActiveTab('categorias')}>Categorías</button>
            </div>

            {activeTab === 'checklists' && <ChecklistsTab preselect={preselect} />}
            {activeTab === 'plantillas' && <PlantillasTab />}
            {activeTab === 'categorias' && <CategoriasTab />}
        </div>
    );
}

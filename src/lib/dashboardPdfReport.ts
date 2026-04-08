import * as htmlToImage from 'html-to-image';
import { toast } from 'react-hot-toast';

interface DashboardStats {
    totalComunidades: number;
    incidenciasPendientes: number;
    incidenciasAplazadas: number;
    incidenciasResueltas: number;
    totalDeuda: number;
    deudaRecuperada: number;
}

interface CronoStats {
    totalSeconds: number;
    totalTasks: number;
    avgSeconds: number;
}

interface Community {
    id: string;
    nombre_cdad: string;
    codigo: string;
}

interface GeneratePDFParams {
    stats: DashboardStats;
    cronoStats: CronoStats;
    chartData: {
        userPerformance: { name: string; assigned: number; resolved: number; pending: number; efficiency: number }[];
        topComunidades: { name: string; count: number }[];
        cronoByGestor: { name: string; tasks: number; seconds: number }[];
    };
    period: string;
    selectedCommunity: string;
    communities: Community[];
    includeCharts?: boolean;
    sections?: string[];
    includeTimeline?: boolean;
    dateFrom?: string;
    dateTo?: string;
}

async function captureChart(id: string): Promise<string | null> {
    const element = document.getElementById(id);
    if (!element) return null;
    try {
        return await htmlToImage.toPng(element, {
            quality: 0.95,
            backgroundColor: '#ffffff',
            pixelRatio: 2
        });
    } catch (err) {
        console.warn(`Error capturing ${id}:`, err);
        return null;
    }
}

function getCommunityLabel(selectedCommunity: string, communities: Community[]): string {
    if (selectedCommunity === 'all') return 'Todas';
    const c = communities.find(c => String(c.id) === selectedCommunity);
    return c ? `${c.codigo} - ${c.nombre_cdad}` : 'Seleccionada';
}

export async function generateDashboardPDF({
    stats, cronoStats, chartData, period, selectedCommunity, communities,
    includeCharts = true, sections = ['incidencias', 'rendimiento', 'deudas'],
    includeTimeline = false, dateFrom, dateTo,
}: GeneratePDFParams): Promise<void> {
    const loadingToast = toast.loading('Generando reporte PDF...');

    try {
        const charts = includeCharts ? {
            evolution: await captureChart('chart-evolution'),
            urgency: await captureChart('chart-urgency'),
            sentiment: await captureChart('chart-sentiment'),
            debtStatus: await captureChart('chart-debt-status'),
            incidentStatus: await captureChart('chart-incident-status'),
            topCommunities: await captureChart('chart-top-communities'),
            debtByCommunity: await captureChart('chart-debt-by-community'),
            cronoTopCommunities: await captureChart('chart-crono-top-communities'),
            cronoGestor: await captureChart('chart-crono-gestor'),
            cronoWeekly: await captureChart('chart-crono-weekly'),
        } : {};

        const communityName = getCommunityLabel(selectedCommunity, communities);

        const payload = {
            stats: {
                ...stats,
                totalDeuda: `${stats.totalDeuda.toLocaleString()}€`
            },
            period,
            communityName,
            charts,
            userPerformance: chartData.userPerformance,
            topComunidades: chartData.topComunidades,
            cronoStats,
            cronoByGestor: chartData.cronoByGestor,
            sections,
            includeTimeline,
            selectedCommunityId: selectedCommunity !== 'all' ? selectedCommunity : null,
            dateFrom: dateFrom || null,
            dateTo: dateTo || null,
        };

        const response = await fetch('/api/dashboard/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Error al generar el PDF');

        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        const safeName = communityName.replace(/[^a-z0-9]/gi, '_');
        const filename = `${dateStr}_Reporte_${safeName}.pdf`;

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Reporte descargado correctamente', { id: loadingToast });
    } catch (error) {
        console.error(error);
        toast.error('Error al generar el reporte', { id: loadingToast });
    }
}

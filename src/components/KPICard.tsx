import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    href?: string;
    color?: string;       // Tailwind border-color class, e.g. 'border-yellow-400'
    iconColor?: string;   // Tailwind text-color class for icon, e.g. 'text-yellow-500'
    trend?: string;       // e.g. '+12% vs mes anterior'
    trendUp?: boolean;    // true = green, false = red, undefined = neutral
}

export default function KPICard({
    title,
    value,
    icon: Icon,
    href,
    color = 'border-yellow-400',
    iconColor = 'text-yellow-500',
    trend,
    trendUp,
}: KPICardProps) {
    const trendColor = trendUp === undefined
        ? 'text-neutral-400'
        : trendUp ? 'text-emerald-600' : 'text-red-500';

    const Content = (
        <div
            className={`
                bg-white rounded-xl p-4 md:p-5
                border border-neutral-200 border-l-4 ${color}
                shadow-sm hover:shadow-md transition-shadow duration-200
                h-full flex flex-col justify-between gap-3
                ${href ? 'cursor-pointer' : ''}
            `}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-neutral-400 leading-tight">
                    {title}
                </p>
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor} opacity-70`} aria-hidden="true" />
            </div>

            <div>
                <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 leading-none tabular-nums">
                    {value}
                </h3>
                {trend && (
                    <p className={`text-[10px] mt-1 font-medium ${trendColor}`}>
                        {trend}
                    </p>
                )}
            </div>
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 rounded-xl">
                {Content}
            </Link>
        );
    }

    return Content;
}

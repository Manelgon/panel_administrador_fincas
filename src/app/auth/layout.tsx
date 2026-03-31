export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="relative min-h-screen flex items-center justify-center overflow-hidden"
            style={{
                background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8f0fe 100%)',
            }}
        >
            {/* Soft decorative blobs */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30"
                style={{
                    background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20"
                style={{
                    background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
                    filter: 'blur(80px)',
                }}
            />

            {/* Subtle dot grid */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                    backgroundImage: `radial-gradient(circle, #94a3b8 1px, transparent 1px)`,
                    backgroundSize: '28px 28px',
                }}
            />

            {/* Content */}
            <div className="relative z-10 w-full max-w-md px-4">
                {children}
            </div>
        </div>
    );
}

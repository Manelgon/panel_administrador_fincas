"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationsRealtime() {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [soundEnabled, setSoundEnabled] = useState(false);
    const [toast, setToast] = useState<{ title: string; body?: string } | null>(null);

    useEffect(() => {
        audioRef.current = new Audio("/sounds/notification.mp3");
        audioRef.current.preload = "auto";
    }, []);

    const enableSound = async () => {
        try {
            setSoundEnabled(true);
            // desbloquea autoplay con interacción
            await audioRef.current?.play();
            audioRef.current?.pause();
            if (audioRef.current) audioRef.current.currentTime = 0;
        } catch {
            setSoundEnabled(false);
        }
    };

    useEffect(() => {
        let channel: any;

        const run = async () => {
            const { data: userRes, error } = await supabase.auth.getUser();
            console.log("[noti] getUser:", userRes?.user?.id, error);

            const user = userRes?.user;
            if (!user) return;

            const filter = `user_id=eq.${user.id}`;
            console.log("[noti] subscribing filter:", filter);

            channel = supabase
                .channel(`notifications:${user.id}`)
                .on(
                    "postgres_changes",
                    { event: "INSERT", schema: "public", table: "notifications", filter },
                    (payload) => {
                        console.log("[noti] INSERT payload:", payload);

                        const n: any = payload.new;
                        setToast({ title: n.title ?? "Aviso", body: n.body ?? "" });
                        window.setTimeout(() => setToast(null), 5000);

                        if (soundEnabled && audioRef.current) {
                            audioRef.current.currentTime = 0;
                            audioRef.current.play().catch(() => { });
                        }
                    }
                )
                .subscribe((status: string) => {
                    console.log("[noti] status:", status);
                });
        };

        run();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [soundEnabled]);

    return (
        <>
            {!soundEnabled && (
                <button
                    onClick={enableSound}
                    className="fixed bottom-6 right-6 z-[9999] rounded-lg bg-black px-4 py-2 text-sm font-semibold text-yellow-400 shadow-lg hover:bg-neutral-900"
                >
                    Activar sonido de avisos
                </button>
            )}

            {toast && (
                <div className="fixed right-6 top-6 z-[9999] w-[360px] rounded-lg border border-neutral-200 bg-white p-4 shadow-xl pointer-events-auto">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-neutral-900">{toast.title}</div>
                            {toast.body ? (
                                <div className="mt-1 line-clamp-3 text-xs text-neutral-600">{toast.body}</div>
                            ) : null}
                        </div>
                        <button
                            onClick={() => setToast(null)}
                            className="rounded-md px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

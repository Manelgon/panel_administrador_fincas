"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "lucide-react";
import { Bell, BellOff } from 'lucide-react';
import { supabase } from "@/lib/supabaseClient";
import { toast } from 'react-hot-toast';

// Global Deduplication Set (Singleton)
// This persists even if component unmounts/remounts strictly or by navigation.
// We store ID -> Timestamp to allow cleanup.
const processedIds = new Map<string, number>();

// Cleanup interval (optional, but good practice)
setInterval(() => {
    const now = Date.now();
    for (const [id, timestamp] of processedIds.entries()) {
        if (now - timestamp > 60000) { // Keep explicitly for 1 minute
            processedIds.delete(id);
        }
    }
}, 30000);

interface NotificationsBellProps {
    align?: 'left' | 'right';
}

export default function NotificationsBell({ align = 'right' }: NotificationsBellProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const userIdRef = useRef<string | null>(null);

    // State for sound preference
    const [soundEnabled, setSoundEnabled] = useState(false);

    // State for unread count
    const [unread, setUnread] = useState(0);

    // Load sound preference and audio
    useEffect(() => {
        const saved = localStorage.getItem('notification_sound_enabled');
        if (saved === 'true') {
            setSoundEnabled(true);
            soundEnabledRef.current = true;
        }

        // Initialize audio with error handling
        const audio = new Audio("/sounds/notification.mp3");
        audio.preload = "auto";
        audio.onerror = (e) => {
            console.error("Audio failed to load:", e);
        };
        audioRef.current = audio;

        // Fetch user
        supabase.auth.getUser().then(({ data }) => {
            userIdRef.current = data.user?.id || null;
            if (data.user?.id) fetchUnread(data.user.id);
        });
    }, []);

    const fetchUnread = async (uid: string) => {
        const { count } = await supabase
            .from("notifications")
            .select('*', { count: 'exact', head: true })
            .eq('user_id', uid)
            .eq('is_read', false);
        setUnread(count || 0);
    };

    // Toggle Sound
    const toggleSound = async () => {
        const newState = !soundEnabled;
        setSoundEnabled(newState);
        localStorage.setItem('notification_sound_enabled', String(newState));

        if (newState) {
            toast.success("Sonido activado 🔔");
            try {
                // Immediately create and play a new audio instance to "unlock" the audio capabilities
                // Browsers whitelist audio playback after a direct user interaction
                const unlockAudio = new Audio("/sounds/notification.mp3");
                unlockAudio.volume = 0.5; // Set reasonable volume
                await unlockAudio.play();
                // We keep it playing briefly to ensure the browser registers the interaction
            } catch (e) {
                console.error("Audio unlock failed", e);
                // If this fails, then we really have a problem, but it shouldn't on a click handler
            }
        } else {
            toast("Sonido desactivado 🔕", { icon: '🔕' });
        }
    };

    const soundEnabledRef = useRef(soundEnabled);
    useEffect(() => {
        soundEnabledRef.current = soundEnabled;
    }, [soundEnabled]);

    // Realtime Listener
    useEffect(() => {
        let channel: any;
        let isMounted = true;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !isMounted) return;

            // Unique channel name each time to avoid 'already joined' errors during hot reload
            const channelName = `notifications:global:${user.id}:${Date.now()}`;

            channel = supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    async (payload) => {
                        if (!isMounted) return;

                        // HANDLE INSERTS (New Notifications)
                        if (payload.eventType === 'INSERT') {
                            const n: any = payload.new;

                            // GLOBAL DEDUPLICATION CHECK
                            if (processedIds.has(n.id)) {
                                return;
                            }
                            processedIds.set(n.id, Date.now());

                            setUnread(p => p + 1);

                            toast((t) => (
                                <div className="flex items-start gap-3 pointer-events-auto cursor-pointer" onClick={() => {
                                    window.location.href = `/dashboard/incidencias/${n.entity_id}`;
                                    toast.dismiss(t.id);
                                }}>
                                    <div>
                                        <p className="font-bold">Nuevo Aviso</p>
                                        <p className="text-sm">{n.title}</p>
                                    </div>
                                </div>
                            ), { position: 'top-right', duration: 5000 });

                            // Audio Playback with Toast Feedback for Errors
                            if (soundEnabledRef.current) {
                                try {
                                    const audio = new Audio("/sounds/notification.mp3");
                                    audio.preload = 'auto';

                                    const playPromise = audio.play();
                                    if (playPromise !== undefined) {
                                        playPromise.catch(error => {
                                            console.warn("Autoplay blocked/failed:", error);
                                            if (error.name === 'NotAllowedError') {
                                                toast("Sonido bloqueado por navegador. Haz click en la página para habilitarlo.", {
                                                    icon: '🔇',
                                                    duration: 4000
                                                });
                                            }
                                        });
                                    }
                                } catch (e) {
                                    console.error("Audio playback error:", e);
                                }
                            }
                        }
                        // HANDLE UPDATES/DELETES (e.g. Marked as read)
                        else {
                            // Ideally minimal fetch, but simplest way to stay consistent
                            await fetchUnread(user.id);
                        }
                    }
                )
                .subscribe();
        };

        setup();

        return () => {
            isMounted = false;
            // Clean up channel on unmount
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, []);


    return (
        <button
            onClick={toggleSound}
            className="relative flex h-10 w-10 items-center justify-center rounded-md bg-black text-yellow-400 hover:bg-neutral-900 transition-colors"
            title={soundEnabled ? "Desactivar sonido" : "Activar sonido"}
        >
            {soundEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5 opacity-70" />}

            {unread > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-yellow-400 px-1.5 py-0.5 text-xs font-bold text-black min-w-[1.25rem]">
                    {unread}
                </span>
            )}
        </button>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Send, User, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Message {
    id: number;
    created_at: string;
    user_id: string;
    content: string;
    profiles: {
        nombre: string;
        avatar_url: string | null;
    };
}

interface TimelineChatProps {
    entityType: 'incidencia' | 'morosidad' | 'gestion' | 'proveedor' | 'comunidad' | 'sofia_incidencia';
    entityId: number | string;
}

export default function TimelineChat({ entityType, entityId }: TimelineChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const numericId = typeof entityId === 'string' ? parseInt(entityId, 10) : entityId;

        fetchMessages();

        // Real-time subscription - Note: We filter in JS because Supabase doesn't support 
        // multiple filters (&) in a single subscription reliably.
        const channel = supabase
            .channel(`record_messages:${entityType}:${numericId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'record_messages'
                },
                async (payload) => {
                    const { entity_type, entity_id, user_id } = payload.new;

                    // Filter in JS
                    if (entity_type !== entityType || String(entity_id) !== String(numericId)) return;

                    // Fetch the user info for the new message
                    const { data: userData } = await supabase
                        .from('profiles')
                        .select('nombre, avatar_url')
                        .eq('user_id', user_id)
                        .single();

                    const fullMessage: Message = {
                        ...payload.new as any,
                        profiles: userData || { nombre: 'Usuario', avatar_url: null }
                    };

                    setMessages((prev) => {
                        // Avoid duplicates if the local insert already added it or race condition
                        if (prev.find(m => m.id === fullMessage.id)) return prev;
                        return [...prev, fullMessage];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [entityType, entityId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            // Ensure entityId is treated as number for BIGINT column if it looks like one
            const numericId = typeof entityId === 'string' ? parseInt(entityId, 10) : entityId;

            const { data, error } = await supabase
                .from('record_messages')
                .select(`
                    id,
                    created_at,
                    user_id,
                    content,
                    profiles:user_id (nombre, avatar_url)
                `)
                .eq('entity_type', entityType)
                .eq('entity_id', numericId)
                .order('created_at', { ascending: true });

            if (error) {
                throw error;
            }

            // Fix: Supabase might return profiles as an array or object
            const formattedMessages = (data as any[])?.map(msg => ({
                ...msg,
                profiles: Array.isArray(msg.profiles) ? msg.profiles[0] : (msg.profiles || { nombre: 'Usuario', avatar_url: null })
            })) || [];

            setMessages(formattedMessages);
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Error al cargar comentarios');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setSending(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const { error } = await supabase
                .from('record_messages')
                .insert([{
                    entity_type: entityType,
                    entity_id: entityId,
                    user_id: user.id,
                    content: newMessage.trim()
                }]);

            if (error) throw error;
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Error al enviar mensaje');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col bg-gray-50 rounded-xl border border-gray-100 overflow-hidden shadow-sm transition-all duration-300">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        💬 Timeline de Gestión
                    </h4>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full border border-gray-100 group-hover:bg-white transition-colors">
                        {messages.length} mensajes
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-yellow-500 transition-colors" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-yellow-500 transition-colors" />
                )}
            </button>

            {isExpanded && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                    {/* Messages Area - Fixed height for 5 messages approx + scroll */}
                    <div className="p-4 overflow-y-auto h-[380px] custom-scrollbar space-y-4 border-b border-gray-100 bg-gray-50/50">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-gray-300" />
                                </div>
                                <p className="text-sm text-gray-400 font-medium italic">
                                    No hay notas de seguimiento aún.<br />Sé el primero en escribir.
                                </p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex-shrink-0">
                                        {msg.profiles.avatar_url ? (
                                            <img
                                                src={msg.profiles.avatar_url}
                                                alt={msg.profiles.nombre}
                                                className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-bold text-xs ring-2 ring-white">
                                                {msg.profiles.nombre.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-bold text-gray-900">{msg.profiles.nombre}</span>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {' - '}
                                                {new Date(msg.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-white">
                        <div className="relative flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Escribe una nota interna..."
                                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-yellow-400 focus:bg-white focus:outline-none transition group"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                disabled={sending}
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="absolute right-1.5 p-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-950 rounded-full transition shadow-sm disabled:opacity-50"
                            >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 px-2">
                            💡 Las notas son visibles para todos los gestores en tiempo real.
                        </p>
                    </form>
                </div>
            )}
        </div>
    );
}

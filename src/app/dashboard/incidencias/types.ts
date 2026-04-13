export interface ImportPreviewRecord {
    status: 'ok' | 'skip';
    comunidad_name: string;
    comunidad_matched?: string;
    motivo: string;
    mensaje: string;
    fecha: string;
    source_raw: string;
    source_mapped?: string | null;
    reason?: string;
    chat_count: number;
    comunidad_not_found?: boolean;
}

export interface ImportPreviewData {
    total_parsed: number;
    to_insert: number;
    to_skip: number;
    records: ImportPreviewRecord[];
}

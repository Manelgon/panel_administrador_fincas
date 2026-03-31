/**
 * Utility to convert a direct Supabase storage URL to a secure proxy URL
 * that handles authentication and redirects to a temporary signed URL.
 */
export const getSecureUrl = (url: string | null | undefined): string => {
    if (!url) return '';

    // If it's already a relative proxy URL or blob, return as is
    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    // If it's a Supabase storage URL, route it through our secure proxy
    if (url.includes('.supabase.co/storage/v1/object/public/')) {
        try {
            const parts = url.split('/object/public/')[1].split('/');
            const bucket = parts[0];
            const path = parts.slice(1).join('/');
            return `/api/storage/view?bucket=${bucket}&path=${encodeURIComponent(path)}`;
        } catch (e) {
            console.error('[getSecureUrl] Error parsing URL:', e);
            return url;
        }
    }

    return url;
};

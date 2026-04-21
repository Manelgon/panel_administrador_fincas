export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
}

/**
 * Returns a safe error message for API responses.
 * Logs the real error server-side, returns a generic message to the client.
 */
export function safeApiError(err: unknown, context?: string): string {
    const real = getErrorMessage(err);
    if (context) {
        console.error(`[${context}]`, real);
    }
    return 'Error interno del servidor';
}

/**
 * Safe error handler for API routes.
 * Logs full error details server-side, returns generic message to clients.
 */
export function safeError(error: unknown): string {
  // Log full details server-side only
  console.error('[API Error]', error)

  // Return generic message to client
  return 'An unexpected error occurred. Please try again.'
}

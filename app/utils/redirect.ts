/**
 * Chemin de retour après connexion, limité aux pages de l'application :
 * refuse les URL absolues et les chemins « //hôte » (redirection ouverte).
 */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  return value
}

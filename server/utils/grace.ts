/** Délais de grâce proposés, en minutes. 0 = échec dès l'heure limite (comportement historique). */
export const GRACE_MINUTES_CHOICES = [0, 15, 30, 60] as const
export type GraceMinutes = typeof GRACE_MINUTES_CHOICES[number]

/** Instant où une échéance encore à faire passe réellement en échec. */
export function expiresAt(dueAt: Date, graceMinutes: number) {
  return new Date(dueAt.getTime() + graceMinutes * 60_000)
}

/** Échéance expirée : l'heure limite et le délai de grâce sont dépassés (borne incluse). */
export function isExpired(dueAt: Date, graceMinutes: number, now = new Date()) {
  return expiresAt(dueAt, graceMinutes).getTime() <= now.getTime()
}

/** Pendant la grâce, l'échéance est « en retard » mais peut encore être validée. */
export function isInGracePeriod(dueAt: Date, graceMinutes: number, now = new Date()) {
  return dueAt.getTime() <= now.getTime() && !isExpired(dueAt, graceMinutes, now)
}

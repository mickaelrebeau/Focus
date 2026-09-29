/** Paliers de streak affichés comme badges sur le profil public (atteints au moins une fois). */
export const STREAK_BADGES = [7, 30, 100, 365] as const

export function badgesFor(longestStreak: number) {
  return STREAK_BADGES.map(days => ({ days, reached: longestStreak >= days }))
}

/** Jour où la série atteint exactement un palier : moment de proposer le partage. */
export function isBadgeDay(currentStreak: number) {
  return (STREAK_BADGES as readonly number[]).includes(currentStreak)
}

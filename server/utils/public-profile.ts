import { and, eq, isNull } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import { badgesFor } from '../../shared/streak-badges'
import { useDatabase, schema } from '../database'

// Suffixe aléatoire : un lien ne se devine pas à partir du nom
const randomSuffix = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 8)

export function slugifyName(displayName: string) {
  const base = displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '')
  return base || 'focus'
}

export function generatePublicSlug(displayName: string) {
  return `${slugifyName(displayName)}-${randomSuffix()}`
}

/**
 * Données exposées par un profil public : nom d'affichage, série et badges.
 * Jamais de crédits, de dette, de conséquences, d'objectifs ni d'email.
 */
export async function getPublicProfile(slug: string) {
  const [row] = await useDatabase()
    .select({
      displayName: schema.users.displayName,
      currentStreak: schema.userStreaks.currentStreak,
      longestStreak: schema.userStreaks.longestStreak,
    })
    .from(schema.users)
    .leftJoin(schema.userStreaks, eq(schema.userStreaks.userId, schema.users.id))
    .where(and(
      eq(schema.users.publicSlug, slug),
      eq(schema.users.isBlocked, false),
      isNull(schema.users.deletedAt),
    ))
    .limit(1)
  if (!row) return null

  const currentStreak = row.currentStreak ?? 0
  const longestStreak = Math.max(row.longestStreak ?? 0, currentStreak)
  return {
    displayName: row.displayName,
    currentStreak,
    longestStreak,
    badges: badgesFor(longestStreak),
  }
}

/** Active (ou renouvelle) le lien public, ou le supprime. Renvoie le lien courant. */
export async function setPublicProfile(user: { id: string, displayName: string }, enabled: boolean, regenerate = false) {
  const db = useDatabase()
  const [current] = await db
    .select({ publicSlug: schema.users.publicSlug })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  let slug: string | null = null
  if (enabled) {
    slug = current?.publicSlug && !regenerate ? current.publicSlug : generatePublicSlug(user.displayName)
  }
  if (slug === (current?.publicSlug ?? null)) return slug

  await db
    .update(schema.users)
    .set({ publicSlug: slug, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
  return slug
}

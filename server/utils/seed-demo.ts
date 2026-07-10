import { addDays, format } from 'date-fns'
import { count, eq, ilike } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../database/schema'
import { generateUpcomingOccurrences } from './goals-service'

type Db = PostgresJsDatabase<typeof schema>

const TIMEZONE = 'Europe/Paris'

function dateOffset(days: number) {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

const DEMO_GOALS = [
  {
    title: 'Publier sur X',
    description: 'Un post par jour pour maintenir la présence en ligne.',
    type: 'recurring' as const,
    category: 'Réseaux sociaux',
    recurrenceType: 'daily' as const,
    recurrenceConfig: { dueTime: '20:00' },
  },
  {
    title: 'Partager sur LinkedIn',
    description: 'Publier du contenu pro les lundis, mercredis et vendredis.',
    type: 'recurring' as const,
    category: 'Réseaux sociaux',
    recurrenceType: 'weekly_days' as const,
    recurrenceConfig: { daysOfWeek: [1, 3, 5], dueTime: '18:00' },
  },
  {
    title: 'Séance de sport',
    description: '3 séances par semaine minimum.',
    type: 'recurring' as const,
    category: 'Santé',
    recurrenceType: 'weekly_count' as const,
    recurrenceConfig: { timesPerWeek: 3, dueTime: '21:00' },
  },
  {
    title: 'Lancer Focus v1',
    description: 'Développement et design de la première version publique.',
    type: 'project' as const,
    category: 'Projet',
    milestones: [
      { title: 'Design system', dueDate: dateOffset(-7) },
      { title: 'MVP fonctionnel', dueDate: dateOffset(14) },
      { title: 'Déploiement Railway', dueDate: dateOffset(28) },
    ],
  },
  {
    title: 'Prototype jeu mobile',
    description: 'Avancer sur un petit jeu en prototype.',
    type: 'project' as const,
    category: 'Jeux vidéo',
    milestones: [
      { title: 'Game design document', dueDate: dateOffset(5) },
      { title: 'Premier niveau jouable', dueDate: dateOffset(20) },
    ],
  },
  {
    title: 'Finir « Deep Work »',
    description: 'Lire le livre avant la fin du mois.',
    type: 'one_time' as const,
    category: 'Lecture',
    dueDate: dateOffset(18),
    recurrenceConfig: { dueTime: '23:59' },
  },
  {
    title: 'Envoyer la proposition client',
    description: 'Finaliser et envoyer le devis pour le projet Acme.',
    type: 'one_time' as const,
    category: 'Travail',
    dueDate: dateOffset(4),
    recurrenceConfig: { dueTime: '17:00' },
  },
]

export async function seedDemoData(db: Db, adminEmail: string, force = false) {
  const [admin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, adminEmail.toLowerCase()))
    .limit(1)

  if (!admin) {
    throw new Error(`Compte admin introuvable (${adminEmail}). Lancez d'abord l'app pour créer l'admin.`)
  }

  const [existingGoals] = await db
    .select({ count: count() })
    .from(schema.goals)
    .where(eq(schema.goals.userId, admin.id))

  if (existingGoals.count > 0 && !force) {
    return { skipped: true, reason: 'Objectifs démo déjà présents pour l\'admin' }
  }

  if (force && existingGoals.count > 0) {
    await clearUserGoals(db, admin.id)
  }

  await db.update(schema.users).set({
    onboardingCompleted: true,
    timezone: TIMEZONE,
  }).where(eq(schema.users.id, admin.id))

  let goalsCreated = 0

  for (const demo of DEMO_GOALS) {
    const [goal] = await db.insert(schema.goals).values({
      userId: admin.id,
      title: demo.title,
      description: demo.description,
      type: demo.type,
      category: demo.category,
      recurrenceType: demo.type === 'recurring' ? demo.recurrenceType : undefined,
      recurrenceConfig: demo.type === 'recurring'
        ? demo.recurrenceConfig
        : demo.type === 'one_time'
          ? demo.recurrenceConfig
          : undefined,
      dueDate: demo.type === 'one_time' ? demo.dueDate : undefined,
    }).returning()

    if (demo.type === 'project' && demo.milestones) {
      await db.insert(schema.projectMilestones).values(
        demo.milestones.map((milestone, index) => ({
          goalId: goal.id,
          title: milestone.title,
          dueDate: milestone.dueDate,
          orderIndex: index,
        })),
      )
    }

    goalsCreated++
  }

  const { created: occurrencesCreated } = await generateUpcomingOccurrences(db)

  return {
    skipped: false,
    adminEmail: admin.email,
    goals: goalsCreated,
    occurrences: occurrencesCreated,
  }
}

async function clearUserGoals(db: Db, userId: string) {
  const userGoals = await db
    .select({ id: schema.goals.id })
    .from(schema.goals)
    .where(eq(schema.goals.userId, userId))

  for (const { id: goalId } of userGoals) {
    const occs = await db
      .select({ id: schema.occurrences.id })
      .from(schema.occurrences)
      .where(eq(schema.occurrences.goalId, goalId))

    for (const occ of occs) {
      await db.delete(schema.validations).where(eq(schema.validations.occurrenceId, occ.id))
    }

    await db.delete(schema.occurrences).where(eq(schema.occurrences.goalId, goalId))
    await db.delete(schema.projectMilestones).where(eq(schema.projectMilestones.goalId, goalId))
  }

  await db.delete(schema.goals).where(eq(schema.goals.userId, userId))
}

export async function removeLegacyDemoUsers(db: Db) {
  const demoUsers = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(ilike(schema.users.email, '%@demo.focus'))

  for (const { id } of demoUsers) {
    await clearUserGoals(db, id)
    await db.delete(schema.creditLedger).where(eq(schema.creditLedger.userId, id))
    await db.delete(schema.wallets).where(eq(schema.wallets.userId, id))
    await db.delete(schema.users).where(eq(schema.users.id, id))
  }

  return demoUsers.length
}

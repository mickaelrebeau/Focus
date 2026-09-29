import { eq, inArray } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { useDatabase, schema } from '../database'
import {
  lockStateFor,
  milestoneLockState,
  prerequisiteOutcome,
  validateGoalDependency,
  type GoalNode,
  type LockState,
} from './dependencies'

type Db = PostgresJsDatabase<typeof schema>

/** État de verrouillage d'un objectif selon son prérequis (`unlocked` s'il n'en a pas). */
export async function goalLockState(dependsOnGoalId: string | null, db: Db = useDatabase()): Promise<LockState> {
  if (!dependsOnGoalId) return 'unlocked'
  const [prerequisite] = await db
    .select({ type: schema.goals.type, isActive: schema.goals.isActive })
    .from(schema.goals)
    .where(eq(schema.goals.id, dependsOnGoalId))
    .limit(1)
  if (!prerequisite) return 'unlocked'

  const occurrences = await db
    .select({ status: schema.occurrences.status, milestoneId: schema.occurrences.milestoneId })
    .from(schema.occurrences)
    .where(eq(schema.occurrences.goalId, dependsOnGoalId))
  const milestoneIds = prerequisite.type === 'project'
    ? (await db.select({ id: schema.projectMilestones.id }).from(schema.projectMilestones).where(eq(schema.projectMilestones.goalId, dependsOnGoalId))).map(row => row.id)
    : []
  return lockStateFor(prerequisiteOutcome(prerequisite, occurrences, milestoneIds))
}

/** Verrous des jalons d'un projet, d'après les échéances déjà générées. */
export async function milestoneLocks(goalId: string, db: Db = useDatabase()) {
  const milestones = await db.select().from(schema.projectMilestones).where(eq(schema.projectMilestones.goalId, goalId))
  const occurrences = await db
    .select({ milestoneId: schema.occurrences.milestoneId, status: schema.occurrences.status })
    .from(schema.occurrences)
    .where(eq(schema.occurrences.goalId, goalId))
  return {
    milestones,
    occurrences,
    locks: new Map(milestones.map(milestone => [milestone.id, milestoneLockState(milestone.dependsOnMilestoneId, occurrences)])),
  }
}

/** Objectifs de l'utilisateur sous forme de graphe, pour valider une nouvelle dépendance. */
export async function userGoalGraph(userId: string, db: Db = useDatabase()) {
  const rows = await db
    .select({
      id: schema.goals.id,
      type: schema.goals.type,
      isActive: schema.goals.isActive,
      dependsOnGoalId: schema.goals.dependsOnGoalId,
    })
    .from(schema.goals)
    .where(eq(schema.goals.userId, userId))
  return new Map<string, GoalNode>(rows.map(row => [row.id, row]))
}

/** Un objectif ou un jalon de cet objectif sert-il de prérequis ? (déblocage à générer après une réussite) */
export async function hasDependents(goalId: string, db: Db = useDatabase()) {
  const [goal] = await db.select({ id: schema.goals.id }).from(schema.goals).where(eq(schema.goals.dependsOnGoalId, goalId)).limit(1)
  if (goal) return true
  const milestones = await db.select({ id: schema.projectMilestones.id }).from(schema.projectMilestones).where(eq(schema.projectMilestones.goalId, goalId))
  if (!milestones.length) return false
  const [chained] = await db
    .select({ id: schema.projectMilestones.id })
    .from(schema.projectMilestones)
    .where(inArray(schema.projectMilestones.dependsOnMilestoneId, milestones.map(m => m.id)))
    .limit(1)
  return Boolean(chained)
}

const DEPENDENCY_ERROR_MESSAGES = {
  self: 'Un objectif ne peut pas dépendre de lui-même',
  not_found: 'Objectif prérequis introuvable',
  recurring_prerequisite: 'Un objectif récurrent ne peut pas servir de prérequis : il n\'est jamais terminé',
  cycle: 'Cette dépendance créerait une boucle entre objectifs',
} as const

/** Valide une dépendance d'objectif, ou lève une erreur 400 explicite. */
export async function assertValidGoalDependency(userId: string, goalId: string | null, dependsOnGoalId: string) {
  const error = validateGoalDependency(goalId, dependsOnGoalId, await userGoalGraph(userId))
  if (error) throw createError({ statusCode: 400, message: DEPENDENCY_ERROR_MESSAGES[error], data: { code: error } })
}

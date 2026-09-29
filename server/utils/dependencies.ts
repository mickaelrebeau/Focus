// Dépendances entre objectifs et entre jalons (« B ne se débloque que si A est réussi »).
// Fonctions pures : utilisées par la génération des échéances, l'API et les tests.
//
// Modes : `soft` = simple affichage (les échéances sont générées normalement) ;
// `hard` = aucune échéance tant que le prérequis n'est pas réussi, donc ni échec ni conséquence.
//
// Pas de blocage définitif :
// - un objectif récurrent ne peut pas être un prérequis (il n'est jamais « réussi » en entier) ;
// - les cycles sont refusés ;
// - un prérequis échoué ou archivé rend la suite « bloquée », avec un déblocage manuel possible.

export const DEPENDENCY_MODES = ['soft', 'hard'] as const
export type DependencyMode = typeof DEPENDENCY_MODES[number]

export type LockState = 'unlocked' | 'locked' | 'blocked'

type OccurrenceStatus = 'pending' | 'completed' | 'failed' | 'skipped'

export interface GoalNode {
  id: string
  type: 'one_time' | 'recurring' | 'project'
  isActive: boolean
  dependsOnGoalId: string | null
}

/** État d'un prérequis d'après ses échéances : réussi, encore possible, ou échoué pour de bon. */
export function prerequisiteOutcome(
  goal: Pick<GoalNode, 'type' | 'isActive'>,
  occurrences: Array<{ status: OccurrenceStatus, milestoneId?: string | null }>,
  milestoneIds: string[] = [],
): 'succeeded' | 'in_progress' | 'failed' {
  if (goal.type === 'recurring') return 'failed'
  const relevant = occurrences.filter(occurrence => occurrence.status !== 'skipped')
  if (relevant.some(occurrence => occurrence.status === 'failed')) return 'failed'

  const succeeded = goal.type === 'project'
    ? milestoneIds.length > 0 && milestoneIds.every(id => relevant.some(o => o.milestoneId === id && o.status === 'completed'))
    : relevant.length > 0 && relevant.every(occurrence => occurrence.status === 'completed')
  if (succeeded) return 'succeeded'
  // Archivé sans avoir été réussi : il ne le sera plus
  return goal.isActive ? 'in_progress' : 'failed'
}

export function lockStateFor(outcome: ReturnType<typeof prerequisiteOutcome> | null): LockState {
  if (outcome === null || outcome === 'succeeded') return 'unlocked'
  return outcome === 'failed' ? 'blocked' : 'locked'
}

/** Jalon : verrouillé tant que le jalon dont il dépend n'a pas une échéance réussie. */
export function milestoneLockState(
  dependsOnMilestoneId: string | null,
  occurrences: Array<{ milestoneId: string | null, status: OccurrenceStatus }>,
): LockState {
  if (!dependsOnMilestoneId) return 'unlocked'
  const previous = occurrences.filter(occurrence => occurrence.milestoneId === dependsOnMilestoneId)
  if (previous.some(occurrence => occurrence.status === 'completed')) return 'unlocked'
  if (previous.some(occurrence => occurrence.status === 'failed')) return 'blocked'
  return 'locked'
}

export type DependencyError = 'self' | 'not_found' | 'recurring_prerequisite' | 'cycle'

/**
 * Vérifie qu'un objectif peut dépendre d'un autre : même propriétaire (présent dans `goals`),
 * prérequis non récurrent, et aucun cycle en suivant la chaîne des dépendances.
 */
export function validateGoalDependency(
  goalId: string | null,
  dependsOnGoalId: string,
  goals: Map<string, GoalNode>,
): DependencyError | null {
  if (goalId && dependsOnGoalId === goalId) return 'self'
  const prerequisite = goals.get(dependsOnGoalId)
  if (!prerequisite) return 'not_found'
  if (prerequisite.type === 'recurring') return 'recurring_prerequisite'

  const seen = new Set<string>()
  let cursor: GoalNode | undefined = prerequisite
  while (cursor?.dependsOnGoalId) {
    if (cursor.dependsOnGoalId === goalId || seen.has(cursor.id)) return 'cycle'
    seen.add(cursor.id)
    cursor = goals.get(cursor.dependsOnGoalId)
  }
  return null
}

/**
 * Date d'échéance à générer pour un élément débloqué : sa date prévue, ou aujourd'hui si elle est
 * passée pendant qu'il était verrouillé (sinon il ne serait jamais généré et bloquerait la suite).
 */
export function effectiveDueDate(plannedDate: string, today: string, hadDependency: boolean) {
  return hadDependency && plannedDate < today ? today : plannedDate
}

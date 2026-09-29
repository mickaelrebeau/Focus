import { describe, it, expect } from 'vitest'
import {
  effectiveDueDate,
  lockStateFor,
  milestoneLockState,
  prerequisiteOutcome,
  validateGoalDependency,
  type GoalNode,
} from '../../server/utils/dependencies'

function graph(...goals: GoalNode[]) {
  return new Map(goals.map(goal => [goal.id, goal]))
}
const node = (id: string, type: GoalNode['type'] = 'one_time', dependsOnGoalId: string | null = null): GoalNode =>
  ({ id, type, isActive: true, dependsOnGoalId })

describe('déblocage d’un objectif', () => {
  const active = { type: 'one_time' as const, isActive: true }

  it('se débloque quand le prérequis ponctuel est réussi', () => {
    expect(prerequisiteOutcome(active, [{ status: 'pending' }])).toBe('in_progress')
    expect(prerequisiteOutcome(active, [{ status: 'completed' }])).toBe('succeeded')
    expect(lockStateFor(prerequisiteOutcome(active, [{ status: 'completed' }]))).toBe('unlocked')
    expect(lockStateFor(prerequisiteOutcome(active, [{ status: 'pending' }]))).toBe('locked')
  })

  it('attend que tous les jalons d’un projet prérequis soient réussis', () => {
    const project = { type: 'project' as const, isActive: true }
    const occurrences = [{ status: 'completed' as const, milestoneId: 'm1' }]
    expect(prerequisiteOutcome(project, occurrences, ['m1', 'm2'])).toBe('in_progress')
    expect(prerequisiteOutcome(project, [...occurrences, { status: 'completed', milestoneId: 'm2' }], ['m1', 'm2'])).toBe('succeeded')
  })

  it('reste bloqué (pas verrouillé indéfiniment) si le prérequis échoue ou est archivé', () => {
    expect(prerequisiteOutcome(active, [{ status: 'failed' }])).toBe('failed')
    expect(prerequisiteOutcome({ type: 'one_time', isActive: false }, [{ status: 'pending' }])).toBe('failed')
    expect(lockStateFor('failed')).toBe('blocked')
  })

  it('ignore les échéances en pause', () => {
    expect(prerequisiteOutcome(active, [{ status: 'skipped' }, { status: 'completed' }])).toBe('succeeded')
    expect(prerequisiteOutcome(active, [{ status: 'skipped' }])).toBe('in_progress')
  })

  it('sans prérequis, rien n’est verrouillé', () => {
    expect(lockStateFor(null)).toBe('unlocked')
  })
})

describe('déblocage d’un jalon', () => {
  it('attend la réussite du jalon précédent', () => {
    expect(milestoneLockState(null, [])).toBe('unlocked')
    expect(milestoneLockState('m1', [])).toBe('locked')
    expect(milestoneLockState('m1', [{ milestoneId: 'm1', status: 'pending' }])).toBe('locked')
    expect(milestoneLockState('m1', [{ milestoneId: 'm1', status: 'completed' }])).toBe('unlocked')
    expect(milestoneLockState('m1', [{ milestoneId: 'm1', status: 'failed' }])).toBe('blocked')
    expect(milestoneLockState('m1', [{ milestoneId: 'm2', status: 'completed' }])).toBe('locked')
  })
})

describe('validation d’une dépendance (pas de deadlock)', () => {
  it('refuse un objectif récurrent comme prérequis : il n’est jamais terminé', () => {
    expect(validateGoalDependency('b', 'a', graph(node('a', 'recurring'), node('b')))).toBe('recurring_prerequisite')
  })

  it('accepte un objectif récurrent qui dépend d’un ponctuel ou d’un projet', () => {
    expect(validateGoalDependency('b', 'a', graph(node('a', 'project'), node('b', 'recurring')))).toBeNull()
    expect(validateGoalDependency(null, 'a', graph(node('a')))).toBeNull()
  })

  it('refuse l’auto-dépendance, un prérequis inconnu et les cycles', () => {
    expect(validateGoalDependency('a', 'a', graph(node('a')))).toBe('self')
    expect(validateGoalDependency('a', 'x', graph(node('a')))).toBe('not_found')
    // a ← b ← c : faire dépendre a de c boucle
    expect(validateGoalDependency('a', 'c', graph(node('a'), node('b', 'one_time', 'a'), node('c', 'one_time', 'b')))).toBe('cycle')
    expect(validateGoalDependency('d', 'c', graph(node('a'), node('b', 'one_time', 'a'), node('c', 'one_time', 'b'), node('d')))).toBeNull()
  })

  it('ne boucle pas sur un graphe déjà incohérent', () => {
    expect(validateGoalDependency('z', 'a', graph(node('a', 'one_time', 'b'), node('b', 'one_time', 'a'), node('z')))).toBe('cycle')
  })
})

describe('date d’un élément débloqué en retard', () => {
  it('ramène une date passée au jour du déblocage, seulement s’il dépendait de quelque chose', () => {
    expect(effectiveDueDate('2026-09-01', '2026-09-29', true)).toBe('2026-09-29')
    expect(effectiveDueDate('2026-10-05', '2026-09-29', true)).toBe('2026-10-05')
    expect(effectiveDueDate('2026-09-01', '2026-09-29', false)).toBe('2026-09-01')
  })
})

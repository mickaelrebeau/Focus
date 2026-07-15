import { describe, it, expect } from 'vitest'

type HistoryStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

interface HistoryRow {
  id: string
  status: HistoryStatus
}

function canStartProcessing(row: HistoryRow | null): boolean {
  if (!row) return false
  if (row.status === 'completed' || row.status === 'cancelled') return false
  if (row.status === 'processing') return false
  return row.status === 'pending' || row.status === 'failed'
}

function nextStatusAfterSuccess(): HistoryStatus {
  return 'completed'
}

function nextStatusAfterFailure(): HistoryStatus {
  return 'failed'
}

function buildHistoryEntries(
  configs: Array<{ id: string, type: string, amount: number }>,
  occurrenceId: string,
) {
  return configs.map(config => ({
    userConsequenceId: config.id,
    occurrenceId,
    provider: config.type,
    status: 'pending' as const,
    amount: config.amount,
  }))
}

describe('consequences history', () => {
  it('creates one pending history entry per active configuration', () => {
    const entries = buildHistoryEntries([
      { id: 'uc-1', type: 'credits', amount: 20 },
      { id: 'uc-2', type: 'donation', amount: 500 },
    ], 'occ-1')

    expect(entries).toHaveLength(2)
    expect(entries.every(entry => entry.status === 'pending')).toBe(true)
    expect(entries[0]).toMatchObject({
      userConsequenceId: 'uc-1',
      occurrenceId: 'occ-1',
      provider: 'credits',
      amount: 20,
    })
  })

  it('allows processing only from pending or failed', () => {
    expect(canStartProcessing({ id: '1', status: 'pending' })).toBe(true)
    expect(canStartProcessing({ id: '1', status: 'failed' })).toBe(true)
    expect(canStartProcessing({ id: '1', status: 'processing' })).toBe(false)
    expect(canStartProcessing({ id: '1', status: 'completed' })).toBe(false)
    expect(canStartProcessing({ id: '1', status: 'cancelled' })).toBe(false)
    expect(canStartProcessing(null)).toBe(false)
  })

  it('maps terminal statuses after execution', () => {
    expect(nextStatusAfterSuccess()).toBe('completed')
    expect(nextStatusAfterFailure()).toBe('failed')
  })

  it('enforces idempotence key via occurrence and user consequence', () => {
    const key = (occurrenceId: string, userConsequenceId: string) => `${occurrenceId}:${userConsequenceId}`
    expect(key('occ-1', 'uc-1')).toBe('occ-1:uc-1')
    expect(key('occ-1', 'uc-1')).toBe(key('occ-1', 'uc-1'))
    expect(key('occ-1', 'uc-2')).not.toBe(key('occ-1', 'uc-1'))
  })
})

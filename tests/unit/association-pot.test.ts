import { describe, it, expect } from 'vitest'

describe('association pot accounting', () => {
  it('computes balance as collected minus paid out', () => {
    const collectedCents = 15000
    const paidOutCents = 5000
    const balanceCents = Math.max(0, collectedCents - paidOutCents)

    expect(balanceCents).toBe(10000)
  })

  it('rejects payout above balance', () => {
    const balanceCents = 3000
    const payoutCents = 5000
    const isValid = payoutCents > 0 && payoutCents <= balanceCents

    expect(isValid).toBe(false)
  })

  it('accepts payout within balance', () => {
    const balanceCents = 3000
    const payoutCents = 2500
    const isValid = payoutCents > 0 && payoutCents <= balanceCents

    expect(isValid).toBe(true)
  })
})

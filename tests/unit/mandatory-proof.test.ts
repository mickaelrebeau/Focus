import { describe, it, expect } from 'vitest'

function hasProofPayload(data: {
  proofType?: 'text' | 'url' | 'image'
  proofContent?: string
  proofUrl?: string
}) {
  if (!data.proofType) return false
  if (data.proofType === 'text') return Boolean(data.proofContent?.trim())
  if (data.proofType === 'url') return Boolean(data.proofUrl?.trim())
  if (data.proofType === 'image') return Boolean(data.proofUrl?.trim())
  return false
}

describe('mandatory proof completion', () => {
  it('requires proof payload when proof is mandatory', () => {
    const proofRequired = true
    const payload = { note: 'Fait' }

    const allowed = !proofRequired || hasProofPayload(payload)
    expect(allowed).toBe(false)
  })

  it('accepts text proof payload', () => {
    const payload = {
      proofType: 'text' as const,
      proofContent: 'Photo envoyée par email',
    }

    expect(hasProofPayload(payload)).toBe(true)
  })

  it('accepts completion without proof when not required', () => {
    const proofRequired = false
    const payload = { note: 'Fait' }

    const allowed = !proofRequired || hasProofPayload(payload)
    expect(allowed).toBe(true)
  })
})

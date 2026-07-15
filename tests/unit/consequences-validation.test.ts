import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getConsequenceProvider } from '../../server/consequences/registry'
import {
  creditsConfigSchema,
  customConfigSchema,
  donationConfigSchema,
  mandatoryProofConfigSchema,
  randomUserConfigSchema,
} from '../../server/consequences/types'

vi.mock('../../server/utils/associations', () => ({
  getActiveAssociationBySlug: vi.fn(async (slug: string) => (
    slug === 'wwf' ? { slug: 'wwf', name: 'WWF' } : null
  )),
}))

describe('consequences validation schemas', () => {
  it('accepts empty credits config', () => {
    expect(creditsConfigSchema.parse({})).toEqual({})
  })

  it('rejects unknown credits config keys', () => {
    expect(() => creditsConfigSchema.parse({ extra: true })).toThrow()
  })

  it('validates donation association via provider', async () => {
    const provider = getConsequenceProvider('donation')
    await expect(provider.validate({ association: 'wwf' })).resolves.toEqual({ association: 'wwf' })
    await expect(provider.validate({ association: 'invalid' })).rejects.toThrow('Association invalide')
  })

  it('validates donation schema', () => {
    expect(donationConfigSchema.parse({ association: 'msf' })).toEqual({ association: 'msf' })
    expect(() => donationConfigSchema.parse({})).toThrow()
  })

  it('validates random user minimum score', () => {
    expect(randomUserConfigSchema.parse({})).toEqual({ minimumScore: 0 })
    expect(randomUserConfigSchema.parse({ minimumScore: 500 })).toEqual({ minimumScore: 500 })
    expect(() => randomUserConfigSchema.parse({ minimumScore: -1 })).toThrow()
  })

  it('validates custom message', () => {
    expect(customConfigSchema.parse({ message: 'Faire 100 pompes' })).toEqual({
      message: 'Faire 100 pompes',
    })
    expect(() => customConfigSchema.parse({ message: '' })).toThrow()
  })

  it('accepts empty mandatory-proof config', () => {
    expect(mandatoryProofConfigSchema.parse({})).toEqual({})
  })
})

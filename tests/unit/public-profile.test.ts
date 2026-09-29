import { describe, it, expect } from 'vitest'
import { badgesFor, isBadgeDay } from '#shared/streak-badges'
import { generatePublicSlug, slugifyName } from '../../server/utils/public-profile'

describe('lien public', () => {
  it('dérive un préfixe lisible du nom, sans accents ni caractères spéciaux', () => {
    expect(slugifyName('Éloïse Martin-Durand')).toBe('eloise-martin-durand')
    expect(slugifyName('  ✨ Zoé  ')).toBe('zoe')
    expect(slugifyName('🔥🔥')).toBe('focus')
    expect(slugifyName('a'.repeat(40))).toHaveLength(24)
  })

  it('ajoute un suffixe aléatoire : deux liens pour le même nom diffèrent', () => {
    const slug = generatePublicSlug('Zoé')
    expect(slug).toMatch(/^zoe-[a-z2-9]{8}$/)
    expect(generatePublicSlug('Zoé')).not.toBe(slug)
  })
})

describe('badges', () => {
  it('marque les paliers atteints d’après le record', () => {
    expect(badgesFor(30)).toEqual([
      { days: 7, reached: true },
      { days: 30, reached: true },
      { days: 100, reached: false },
      { days: 365, reached: false },
    ])
    expect(badgesFor(0).every(badge => !badge.reached)).toBe(true)
  })

  it('propose le partage le jour exact d’un palier', () => {
    expect([7, 30, 100, 365].every(isBadgeDay)).toBe(true)
    expect(isBadgeDay(8)).toBe(false)
    expect(isBadgeDay(14)).toBe(false)
  })
})

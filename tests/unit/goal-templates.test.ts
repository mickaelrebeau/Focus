import { describe, it, expect } from 'vitest'
import catalogJson from '../../shared/goal-templates.json'
import {
  TEMPLATE_ICON_NAMES,
  findTemplate,
  goalCatalog,
  goalCatalogSchema,
  localizeEntry,
  templateToGoalPayload,
} from '../../shared/goal-templates'
import { createGoalSchema } from '../../server/utils/validation'

describe('catalogue de modèles (shared/goal-templates.json)', () => {
  it('contient au moins 8 modèles en français', () => {
    const french = goalCatalog.templates.filter(template => template.locales.fr.title)
    expect(french.length).toBeGreaterThanOrEqual(8)
  })

  it('chaque modèle produit un objectif accepté par l’API, dans chaque langue', () => {
    for (const template of goalCatalog.templates) {
      for (const locale of ['fr', 'en']) {
        const result = createGoalSchema.safeParse(templateToGoalPayload(template, locale))
        expect(result.success, `${template.id} (${locale}) : ${result.error?.issues[0]?.message}`).toBe(true)
      }
    }
  })

  it('chaque pack référence des modèles existants', () => {
    for (const pack of goalCatalog.packs) {
      for (const id of pack.templateIds) {
        expect(findTemplate(id), `${pack.id} → ${id}`).toBeDefined()
      }
    }
  })

  it('traduit avec repli sur le français', () => {
    const template = findTemplate('lire-20-pages')!
    expect(localizeEntry(template, 'en').title).toBe('Read 20 pages')
    expect(localizeEntry(template, 'de').title).toBe('Lire 20 pages')
  })

  it('préremplit la récurrence et l’heure du modèle', () => {
    expect(templateToGoalPayload(findTemplate('post-linkedin')!, 'fr')).toMatchObject({
      type: 'recurring',
      title: 'Publier sur LinkedIn',
      category: 'Réseaux sociaux',
      recurrenceType: 'weekly_days',
      recurrenceConfig: { daysOfWeek: [2, 4], dueTime: '12:00' },
    })
  })
})

describe('icônes Hugeicons', () => {
  it('chaque icône autorisée existe dans le jeu gratuit Hugeicons et est enregistrée côté app', async () => {
    const free = await import('@hugeicons/core-free-icons') as Record<string, unknown>
    const { templateIcons } = await import('../../app/utils/template-icons')
    for (const name of TEMPLATE_ICON_NAMES) {
      expect(free[name], `${name} absent de @hugeicons/core-free-icons`).toBeDefined()
      expect(templateIcons[name], `${name} absent de app/utils/template-icons.ts`).toBe(free[name])
    }
    expect(Object.keys(templateIcons).sort()).toEqual([...TEMPLATE_ICON_NAMES].sort())
  })
})

describe('validation d’une contribution au catalogue', () => {
  const base = structuredClone(catalogJson)

  function parse(mutate: (catalog: typeof base) => void) {
    const catalog = structuredClone(base)
    mutate(catalog)
    return goalCatalogSchema.safeParse(catalog)
  }

  it('refuse un identifiant en double', () => {
    const result = parse(catalog => catalog.templates.push(structuredClone(catalog.templates[0]!)))
    expect(result.error?.issues[0]?.message).toMatch(/Modèle en double/)
  })

  it('refuse un pack vers un modèle inconnu', () => {
    const result = parse(catalog => catalog.packs[0]!.templateIds.push('inexistant'))
    expect(result.error?.issues[0]?.message).toMatch(/modèle inconnu inexistant/)
  })

  it('refuse une heure invalide', () => {
    const result = parse((catalog) => { catalog.templates[0]!.dueTime = '25:00' })
    expect(result.success).toBe(false)
  })

  it('refuse une icône hors liste (emoji ou nom inconnu)', () => {
    expect(parse((catalog) => { catalog.templates[0]!.icon = '🏋️' }).success).toBe(false)
  })

  it('exige la version française', () => {
    const result = parse((catalog) => {
      delete (catalog.templates[0]!.locales as Partial<typeof catalog.templates[0]['locales']>).fr
    })
    expect(result.success).toBe(false)
  })
})

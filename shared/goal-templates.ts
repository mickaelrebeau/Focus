import { z } from 'zod'
import catalog from './goal-templates.json'

// Format du catalogue shared/goal-templates.json. Le fichier est validé au chargement :
// une contribution mal formée échoue immédiatement (et en CI) avec un message explicite.

/**
 * Icônes gratuites Hugeicons utilisables dans le catalogue (nom de l'export de
 * @hugeicons/core-free-icons). Pour en ajouter une : l'ajouter ici et dans
 * app/utils/template-icons.ts (un test vérifie que les deux listes concordent).
 */
export const TEMPLATE_ICON_NAMES = [
  'Book02Icon',
  'Calendar03Icon',
  'Dumbbell01Icon',
  'FavouriteIcon',
  'LanguageSkillIcon',
  'Linkedin01Icon',
  'Moon02Icon',
  'PaintBrush01Icon',
  'Pen01Icon',
  'Rocket01Icon',
  'RunningShoesIcon',
  'Target01Icon',
  'Yoga01Icon',
] as const

export type TemplateIconName = typeof TEMPLATE_ICON_NAMES[number]

const iconSchema = z.enum(TEMPLATE_ICON_NAMES, { message: 'icône inconnue (voir TEMPLATE_ICON_NAMES)' })

const localeTextSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  category: z.string().min(1).max(50),
})

const recurrenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }),
  z.object({ type: z.literal('weekly_days'), daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1) }),
  z.object({ type: z.literal('weekly_count'), timesPerWeek: z.number().int().min(1).max(7) }),
])

export const goalTemplateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'identifiant en minuscules, chiffres et tirets'),
  icon: iconSchema,
  recurrence: recurrenceSchema,
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'heure au format HH:MM'),
  suggestedConsequence: z.object({
    type: z.enum(['credits', 'mandatory-proof', 'custom', 'random-user', 'donation']),
    amount: z.number().int().positive().optional(),
  }).optional(),
  // Le français est la langue de référence : obligatoire. Les autres langues sont facultatives.
  locales: z.object({ fr: localeTextSchema }).catchall(localeTextSchema),
})

export const goalPackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  icon: iconSchema,
  templateIds: z.array(z.string()).min(2),
  locales: z.object({ fr: localeTextSchema.omit({ category: true }) })
    .catchall(localeTextSchema.omit({ category: true })),
})

export const goalCatalogSchema = z.object({
  templates: z.array(goalTemplateSchema).min(1),
  packs: z.array(goalPackSchema),
}).superRefine((value, ctx) => {
  const ids = new Set<string>()
  for (const template of value.templates) {
    if (ids.has(template.id)) ctx.addIssue({ code: 'custom', message: `Modèle en double : ${template.id}` })
    ids.add(template.id)
  }
  for (const pack of value.packs) {
    for (const id of pack.templateIds) {
      if (!ids.has(id)) ctx.addIssue({ code: 'custom', message: `Pack ${pack.id} : modèle inconnu ${id}` })
    }
  }
})

export type GoalTemplate = z.infer<typeof goalTemplateSchema>
export type GoalPack = z.infer<typeof goalPackSchema>

export const goalCatalog = goalCatalogSchema.parse(catalog)

/** Textes d'un modèle ou d'un pack dans la langue demandée, avec repli sur le français. */
export function localizeEntry<T>(entry: { locales: { fr: T } & Record<string, T> }, locale: string): T {
  return entry.locales[locale] ?? entry.locales.fr
}

export function findTemplate(id: string) {
  return goalCatalog.templates.find(template => template.id === id)
}

/** Objectif prêt à envoyer à POST /api/goals (création d'un pack, préremplissage). */
export function templateToGoalPayload(template: GoalTemplate, locale: string) {
  const text = localizeEntry(template, locale)
  const { recurrence } = template
  return {
    type: 'recurring' as const,
    title: text.title,
    description: text.description || undefined,
    category: text.category,
    recurrenceType: recurrence.type,
    recurrenceConfig: {
      daysOfWeek: recurrence.type === 'weekly_days' ? recurrence.daysOfWeek : undefined,
      timesPerWeek: recurrence.type === 'weekly_count' ? recurrence.timesPerWeek : undefined,
      dueTime: template.dueTime,
    },
  }
}

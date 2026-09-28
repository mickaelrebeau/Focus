import {
  formatEuroFromCents,
  isMonetaryConsequenceType,
  type ConsequenceEstimate,
  type ConsequenceType,
  type UserConsequence,
} from '~/composables/useConsequences'

// Les noms, descriptions et estimations des conséquences sont produits par le serveur, en
// français. Une langue peut les surcharger via `consequences.types.<clé>` et
// `consequences.estimates.<clé>` ; à défaut, le texte du serveur est affiché.
export function useConsequenceText() {
  const { t, te, localeProperties } = useI18n()

  const languageTag = computed(() => localeProperties.value.language ?? 'fr-FR')

  function typeName(key: string, type?: ConsequenceType) {
    const path = `consequences.types.${key}.name`
    return te(path) ? t(path) : type?.name ?? key
  }

  function typeDescription(key: string, type?: ConsequenceType) {
    const path = `consequences.types.${key}.description`
    return te(path) ? t(path) : type?.description ?? ''
  }

  function estimate(
    consequence: UserConsequence,
    serverEstimate: ConsequenceEstimate | null | undefined,
    associationLabel?: string,
  ): ConsequenceEstimate | null {
    const base = `consequences.estimates.${consequence.type}`
    if (!serverEstimate || !te(`${base}.label`)) return serverEstimate ?? null

    const minimumScore = Number(consequence.config.minimumScore ?? 0)
    const params = {
      amount: isMonetaryConsequenceType(consequence.type)
        ? formatEuroFromCents(consequence.amount, languageTag.value)
        : consequence.amount,
      association: associationLabel ?? String(consequence.config.association ?? ''),
      score: minimumScore,
    }
    const descriptionPath = consequence.type === 'random-user' && minimumScore > 0
      ? 'consequences.estimates.random-user-min.description'
      : `${base}.description`

    return {
      label: t(`${base}.label`, params),
      // Message saisi par l'utilisateur pour une conséquence personnalisée
      description: te(descriptionPath) ? t(descriptionPath, params) : serverEstimate.description,
    }
  }

  function formatAmount(cents: number) {
    return formatEuroFromCents(cents, languageTag.value)
  }

  return { typeName, typeDescription, estimate, formatAmount }
}

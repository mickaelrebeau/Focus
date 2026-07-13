export const DONATION_ASSOCIATIONS = [
  { value: 'wwf', label: 'WWF', connectEnvKey: 'STRIPE_CONNECT_WWF' },
  { value: 'msf', label: 'Médecins Sans Frontières', connectEnvKey: 'STRIPE_CONNECT_MSF' },
  { value: 'croix-rouge', label: 'Croix-Rouge', connectEnvKey: 'STRIPE_CONNECT_CROIX_ROUGE' },
  { value: 'restos-coeur', label: 'Restos du Cœur', connectEnvKey: 'STRIPE_CONNECT_RESTOS_COEUR' },
] as const

export type DonationAssociationValue = typeof DONATION_ASSOCIATIONS[number]['value']

export function getDonationAssociationConnectAccountId(association: string): string | null {
  const item = DONATION_ASSOCIATIONS.find(entry => entry.value === association)
  if (!item) return null
  return process.env[item.connectEnvKey] || null
}

export function getDonationAssociationConnectStatus() {
  return DONATION_ASSOCIATIONS.map((association) => {
    const accountId = process.env[association.connectEnvKey] || null
    return {
      value: association.value,
      label: association.label,
      connectEnvKey: association.connectEnvKey,
      configured: Boolean(accountId),
      accountIdSuffix: accountId ? accountId.slice(-6) : null,
    }
  })
}

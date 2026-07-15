/** @deprecated Utiliser les associations en base via /api/associations */
export const DONATION_ASSOCIATIONS = [
  { value: 'wwf', label: 'WWF' },
  { value: 'msf', label: 'Médecins Sans Frontières' },
  { value: 'croix-rouge', label: 'Croix-Rouge' },
  { value: 'restos-coeur', label: 'Restos du Cœur' },
] as const

export type DonationAssociationValue = typeof DONATION_ASSOCIATIONS[number]['value']

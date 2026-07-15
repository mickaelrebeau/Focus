import { getPublicAssociationPots, getAssociationPayoutHistory } from '../../utils/association-pot'

export default defineEventHandler(async () => {
  const associations = await getPublicAssociationPots()
  const payouts = await getAssociationPayoutHistory(undefined, 100)

  const payoutsByAssociation = payouts.reduce<Record<string, typeof payouts>>((acc, payout) => {
    if (!acc[payout.associationSlug]) {
      acc[payout.associationSlug] = []
    }
    acc[payout.associationSlug].push(payout)
    return acc
  }, {})

  return {
    associations: associations.map(association => ({
      slug: association.slug,
      name: association.name,
      description: association.description,
      logoUrl: association.logoUrl,
      collectedCents: association.collectedCents,
      paidOutCents: association.paidOutCents,
      balanceCents: association.balanceCents,
      monthCents: association.monthCents,
      contributionCount: association.contributionCount,
      payouts: (payoutsByAssociation[association.slug] ?? []).map(payout => ({
        period: payout.period,
        amount: payout.amount,
        createdAt: payout.createdAt,
      })),
    })),
    updatedAt: new Date().toISOString(),
  }
})

import { listActiveAssociations } from '../../utils/associations'

export default defineEventHandler(async () => {
  const associations = await listActiveAssociations()

  return {
    associations: associations.map(association => ({
      value: association.slug,
      label: association.name,
      description: association.description,
      logoUrl: association.logoUrl,
    })),
  }
})

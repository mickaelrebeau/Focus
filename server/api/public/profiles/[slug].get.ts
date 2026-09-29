import { getPublicProfile } from '../../../utils/public-profile'

// Profil public (sans authentification) : uniquement nom, série et badges
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  // Un profil désactivé doit disparaître tout de suite : aucun cache partagé
  setHeader(event, 'Cache-Control', 'no-store')

  const profile = /^[a-z0-9-]{1,40}$/.test(slug) ? await getPublicProfile(slug) : null
  if (!profile) throw createError({ statusCode: 404, message: 'Profil introuvable' })
  return profile
})

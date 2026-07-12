import { readMultipartFormData } from 'h3'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { uploadProofImage } from '../../utils/s3'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file' && part.data)

  if (!file?.data || !file.type) {
    throw createError({ statusCode: 400, message: 'Fichier image requis' })
  }

  const result = await uploadProofImage(user.id, file.data, file.type)
  return { url: result.url, key: result.key }
})

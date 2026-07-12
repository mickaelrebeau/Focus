import { randomBytes } from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const MAX_PROOF_BYTES = 5 * 1024 * 1024

let s3Client: S3Client | null = null

function getS3Client() {
  if (!s3Client) {
    const config = useRuntimeConfig()
    s3Client = new S3Client({
      region: 'auto',
      endpoint: config.s3Endpoint,
      credentials: {
        accessKeyId: config.s3AccessKey,
        secretAccessKey: config.s3SecretKey,
      },
      forcePathStyle: true,
    })
  }
  return s3Client
}

export function assertS3Configured() {
  const config = useRuntimeConfig()
  if (!config.s3Bucket || !config.s3Endpoint || !config.s3AccessKey || !config.s3SecretKey) {
    throw createError({ statusCode: 503, message: 'Stockage des preuves non configuré' })
  }
}

function buildPublicUrl(key: string) {
  const config = useRuntimeConfig()
  const endpoint = config.s3Endpoint.replace(/\/$/, '')
  return `${endpoint}/${config.s3Bucket}/${key}`
}

export async function uploadProofImage(userId: string, data: Buffer, contentType: string) {
  assertS3Configured()

  if (data.byteLength > MAX_PROOF_BYTES) {
    throw createError({ statusCode: 400, message: 'Image trop volumineuse après compression (max 5 Mo)' })
  }

  if (!contentType.startsWith('image/')) {
    throw createError({ statusCode: 400, message: 'Le fichier doit être une image' })
  }

  const config = useRuntimeConfig()
  const extension = contentType === 'image/png' ? 'png' : 'jpg'
  const key = `proofs/${userId}/${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`

  await getS3Client().send(new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  }))

  return {
    key,
    url: buildPublicUrl(key),
  }
}

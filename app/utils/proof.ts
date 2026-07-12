const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.82
const MAX_INPUT_BYTES = 15 * 1024 * 1024

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export function isAcceptedImageType(type: string) {
  return ACCEPTED_TYPES.has(type)
}

export async function compressImage(file: File): Promise<Blob> {
  if (!isAcceptedImageType(file.type)) {
    throw new Error('Format d\'image non supporté (JPEG, PNG ou WebP)')
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image trop volumineuse (max 15 Mo)')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Impossible de compresser l\'image')
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })

  if (!blob) {
    throw new Error('Compression de l\'image échouée')
  }

  return blob
}

export function normalizeProofUrl(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

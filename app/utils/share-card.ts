// Carte de partage « 30 jours de Focus » : image PNG carrée dessinée dans le navigateur
// (aucune donnée envoyée à un service tiers). Format carré : lisible en story, en post ou en aperçu.

export const SHARE_CARD_SIZE = 1080

export interface ShareCardContent {
  headline: string
  subline: string
  name: string
  badges: Array<{ label: string, reached: boolean }>
  footer: string
}

const INK = '#111827'
const CANVAS = '#FAFAFA'
const MUTED = '#86868B'
const LINE = '#E8E8ED'
const FONT = '"Open Sans", system-ui, -apple-system, "Segoe UI", sans-serif'

function fitText(context: CanvasRenderingContext2D, text: string, weight: number, maxSize: number, maxWidth: number) {
  let size = maxSize
  do {
    context.font = `${weight} ${size}px ${FONT}`
    if (context.measureText(text).width <= maxWidth) break
    size -= 4
  } while (size > 24)
  return size
}

export function drawShareCard(canvas: HTMLCanvasElement, content: ShareCardContent) {
  const size = SHARE_CARD_SIZE
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponible')

  const margin = 96
  const width = size - margin * 2

  context.fillStyle = CANVAS
  context.fillRect(0, 0, size, size)
  context.fillStyle = INK
  context.fillRect(0, 0, size, 16)

  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
  context.fillStyle = MUTED
  context.font = `600 40px ${FONT}`
  context.fillText(content.name, margin, 200, width)

  context.fillStyle = INK
  const headlineSize = fitText(context, content.headline, 800, 132, width)
  context.fillText(content.headline, margin, 200 + headlineSize + 40)

  context.fillStyle = MUTED
  context.font = `500 44px ${FONT}`
  context.fillText(content.subline, margin, 200 + headlineSize + 130, width)

  // Badges de paliers : pastilles pleines si atteints, contour sinon
  const badgeTop = 700
  const gap = 24
  const badgeWidth = (width - gap * (content.badges.length - 1)) / content.badges.length
  content.badges.forEach((badge, index) => {
    const x = margin + index * (badgeWidth + gap)
    context.beginPath()
    context.roundRect(x, badgeTop, badgeWidth, 120, 60)
    if (badge.reached) {
      context.fillStyle = INK
      context.fill()
    } else {
      context.strokeStyle = LINE
      context.lineWidth = 4
      context.stroke()
    }
    context.fillStyle = badge.reached ? '#FFFFFF' : MUTED
    context.textAlign = 'center'
    context.font = `700 ${fitText(context, badge.label, 700, 40, badgeWidth - 32)}px ${FONT}`
    context.fillText(badge.label, x + badgeWidth / 2, badgeTop + 74)
    context.textAlign = 'left'
  })

  context.fillStyle = INK
  context.font = `800 48px ${FONT}`
  context.fillText('Focus', margin, size - margin)
  context.fillStyle = MUTED
  context.font = `500 32px ${FONT}`
  context.textAlign = 'right'
  context.fillText(content.footer, size - margin, size - margin, width - 220)
  context.textAlign = 'left'
}

export function shareCardBlob(content: ShareCardContent) {
  const canvas = document.createElement('canvas')
  drawShareCard(canvas, content)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Image indisponible'))), 'image/png')
  })
}

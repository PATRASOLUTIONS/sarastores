import QRCode from 'qrcode'

export const STORE_POSTER_IMAGE = '/diwali-store-poster.webp'

async function loadImage(url: string) {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

/** Keep the full quiet zone and store-specific tracking URL when embedding the QR. */
export async function createStorePoster(store: { url: string; name: string; code: string }) {
  const [background, qr] = await Promise.all([
    loadImage(STORE_POSTER_IMAGE),
    QRCode.toDataURL(store.url, { width: 540, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }).then(loadImage),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = background.naturalWidth
  canvas.height = background.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Poster rendering is unavailable.')
  context.drawImage(background, 0, 0)
  context.textAlign = 'center'
  context.fillStyle = '#7f1d1d'
  let size = 38
  const name = store.name || 'SARA Store'
  do { context.font = `bold ${size}px Arial, sans-serif`; if (context.measureText(name).width <= 840) break; size -= 2 } while (size > 20)
  context.fillText(name, 599.5, 405, 840)
  context.imageSmoothingEnabled = false
  context.drawImage(qr, 329.5, 430, 540, 540)
  context.font = '24px Arial, sans-serif'
  context.fillText(`${store.code} · Scan to register`, 599.5, 998, 820)
  return canvas.toDataURL('image/png')
}

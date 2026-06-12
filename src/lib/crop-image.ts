import type { Area } from 'react-easy-crop'

/**
 * Renders the selected crop region onto an offscreen canvas and returns it as
 * a JPEG blob, downscaled to at most `maxSize` square so the upload stays far
 * below the server's 1 MB cap (~100–250 KB at quality 0.85). If a pathological
 * source still exceeds 1 MB, one retry at quality 0.7 brings it under.
 *
 * EXIF orientation needs no special handling: browsers apply it when decoding
 * (`image-orientation: from-image` is the default), and the server bakes
 * orientation again as the final guarantee.
 */
export async function getCroppedBlob(
  imageSrc: string,
  cropPixels: Area,
  maxSize = 800,
): Promise<Blob> {
  const image = await loadImage(imageSrc)

  const side = Math.min(Math.round(cropPixels.width), maxSize)
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image in this browser.')
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    side,
    side,
  )

  const blob = await toJpegBlob(canvas, 0.85)
  if (blob.size <= 1024 * 1024) return blob
  return toJpegBlob(canvas, 0.7)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new Error('Could not read that image. Try a different photo.'))
    image.src = src
  })
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Could not process the image in this browser.')),
      'image/jpeg',
      quality,
    )
  })
}

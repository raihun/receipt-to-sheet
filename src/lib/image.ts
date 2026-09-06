export type PreparedImage = {
  /** data URI プレフィックスを除いた base64 */
  base64: string
  mediaType: 'image/jpeg'
  /** プレビュー表示用の blob URL。使い終わったら revokeObjectURL すること */
  previewUrl: string
  /** リサイズ後の実寸。プレビューを等倍で見せるために使う */
  width: number
  height: number
  /** JPEG のバイト数 */
  bytes: number
}

/** 長辺のピクセル数。プレビュー画面から選べる */
export const MAX_EDGE_CHOICES = [1000, 1500, 2000, 2500] as const

export const DEFAULT_MAX_EDGE = 1500

const JPEG_QUALITY = 0.85

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  // EXIF の向きを反映させたい。options 付き createImageBitmap は Safari 16+ で使える
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** 長辺 maxEdge に縮小した JPEG を作る。トークン量と待ち時間を抑えるため */
export async function prepareImage(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
): Promise<PreparedImage> {
  const source = await decode(file)
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height))
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像の変換に失敗しました（canvas を初期化できません）')
  ctx.drawImage(source, 0, 0, width, height)
  if ('close' in source) source.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('画像の変換に失敗しました')

  return {
    base64: await blobToBase64(blob),
    mediaType: 'image/jpeg',
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    bytes: blob.size,
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

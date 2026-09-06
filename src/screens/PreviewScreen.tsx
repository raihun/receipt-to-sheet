import { useState } from 'react'
import { MAX_EDGE_CHOICES } from '../lib/image'
import type { PreparedImage } from '../lib/image'

type Props = {
  image: PreparedImage
  maxEdge: number
  /** 解像度を変えている間は true。同じ写真から作り直している */
  resizing: boolean
  onChangeMaxEdge: (maxEdge: number) => void
  onAnalyze: () => void
  onRetake: () => void
}

export function PreviewScreen({
  image,
  maxEdge,
  resizing,
  onChangeMaxEdge,
  onAnalyze,
  onRetake,
}: Props) {
  // 既定は等倍。1500pxがどれくらいかを見るのが目的なので、縮めて見せては意味がない
  const [actualSize, setActualSize] = useState(true)

  return (
    <div className="screen">
      <h1>プレビュー</h1>
      <p className="note">
        送信されるのはこの画像です。合計欄と商品名が読めるか確認してください。
      </p>

      <div className={actualSize ? 'zoom-frame' : 'zoom-frame fit'}>
        <img
          src={image.previewUrl}
          alt="送信される画像"
          width={image.width}
          height={image.height}
        />
      </div>

      <div className="meta">
        <span>
          {image.width} × {image.height} px
        </span>
        <span>{Math.round(image.bytes / 1024).toLocaleString()} KB</span>
        <button className="link" onClick={() => setActualSize((v) => !v)}>
          {actualSize ? '画面に合わせる' : '等倍で見る'}
        </button>
      </div>
      {actualSize && (
        <p className="note">
          等倍表示です。枠の中を指でなぞって、端まで確認できます。
        </p>
      )}

      <h2>長辺の解像度</h2>
      <div className="seg">
        {MAX_EDGE_CHOICES.map((choice) => (
          <button
            key={choice}
            className={choice === maxEdge ? 'seg-item active' : 'seg-item'}
            disabled={resizing}
            onClick={() => onChangeMaxEdge(choice)}
          >
            {choice}
          </button>
        ))}
      </div>
      <p className="note">
        撮り直さずに切り替えて見比べられます。選んだ値は次回以降も使われます。
        下げるほど速く安くなりますが、掠れた文字を拾えなくなります。
      </p>

      <button className="primary" disabled={resizing} onClick={onAnalyze}>
        {resizing ? '作り直しています…' : 'この画像で解析'}
      </button>
      <button className="ghost" disabled={resizing} onClick={onRetake}>
        撮り直す
      </button>
    </div>
  )
}

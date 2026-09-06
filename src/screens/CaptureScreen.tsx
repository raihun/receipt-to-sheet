import { useRef } from 'react'

type Props = {
  error: string | null
  onPick: (file: File) => void
  onOpenSettings: () => void
}

export function CaptureScreen({ error, onPick, onOpenSettings }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="screen">
      <h1>レシートを撮る</h1>
      {error !== null && <p className="error">{error}</p>}
      <p className="note">合計欄まで写るように、真上から撮ってください。</p>

      <input
        ref={inputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // 同じファイルを選び直したときも onChange が起きるように値を戻す
          e.target.value = ''
          if (file) onPick(file)
        }}
      />

      <button className="primary" onClick={() => inputRef.current?.click()}>
        カメラを起動
      </button>
      <button className="ghost" onClick={onOpenSettings}>
        設定
      </button>
    </div>
  )
}

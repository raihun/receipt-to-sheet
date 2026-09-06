type Props = {
  message: string
  onNext: () => void
}

export function DoneScreen({ message, onNext }: Props) {
  return (
    <div className="screen center">
      <div className="check">✓</div>
      <h1>追記しました</h1>
      <p className="note">{message}</p>
      <button className="primary" onClick={onNext}>
        続けて撮る
      </button>
    </div>
  )
}

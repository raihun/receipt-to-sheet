import { useState } from 'react'
import { HISTORY_LIMIT } from '../lib/history'
import type { HistoryEntry } from '../lib/history'

type Props = {
  entries: HistoryEntry[]
  onOpen: (entry: HistoryEntry) => void
  onClear: () => void
  onBack: () => void
}

export function HistoryScreen({ entries, onOpen, onClear, onBack }: Props) {
  // デバッグ用。解析結果のJSONをそのまま見せる
  const [rawId, setRawId] = useState<string | null>(null)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="link left" onClick={onBack}>
          ← ホームに戻る
        </button>
      </div>
      <h1>履歴</h1>
      <p className="note">
        直近{HISTORY_LIMIT}件の解析結果をこの端末に保存しています。開くとAPIを呼ばずに
        確認画面を再現します。
      </p>

      {entries.length === 0 && <p className="note">まだ履歴がありません。</p>}

      {entries.map((entry) => (
        <div className="card" key={entry.id}>
          <div className="card-head">
            <span className="card-title">
              {entry.receipt.store === '' ? '（店名なし）' : entry.receipt.store}
            </span>
            <span className="amount">¥{entry.receipt.total.toLocaleString()}</span>
          </div>

          <div className="meta">
            <span>{entry.receipt.date === '' ? '日付なし' : entry.receipt.date}</span>
            <span>{entry.receipt.items.length}品</span>
            <span className={entry.submitted === null ? 'pending' : 'sent'}>
              {entry.submitted === null ? '未送信' : '送信済'}
            </span>
          </div>

          {entry.submitted !== null && (
            <p className="note">
              {entry.submitted.category}
              {entry.submitted.subCategory === '' ? '' : ` / ${entry.submitted.subCategory}`}
              　{entry.submitted.message}
            </p>
          )}

          <div className="meta">
            <span>{formatSavedAt(entry.savedAt)}</span>
            <span>
              {entry.model} / 長辺{entry.maxEdge}px
            </span>
          </div>

          <div className="seg">
            <button className="seg-item" onClick={() => onOpen(entry)}>
              開く
            </button>
            <button
              className="seg-item"
              onClick={() => setRawId((id) => (id === entry.id ? null : entry.id))}
            >
              {rawId === entry.id ? 'JSONを隠す' : 'JSONを見る'}
            </button>
          </div>

          {rawId === entry.id && (
            <pre className="raw">{JSON.stringify(entry.receipt, null, 2)}</pre>
          )}
        </div>
      ))}

      <button className="ghost" onClick={onBack}>
        戻る
      </button>
      {entries.length > 0 && (
        <button className="danger" onClick={onClear}>
          履歴を消す
        </button>
      )}
    </div>
  )
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

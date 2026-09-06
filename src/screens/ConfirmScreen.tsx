import { useMemo, useState } from 'react'
import type { Receipt } from '../types'

type Row = { name: string; price: string; originalPrice: number | null }

type Props = {
  receipt: Receipt
  previewUrl: string
  submitting: boolean
  error: string | null
  onSubmit: (result: { date: string; store: string; total: number; top5: string[] }) => void
  onRetake: () => void
}

export function ConfirmScreen({
  receipt,
  previewUrl,
  submitting,
  error,
  onSubmit,
  onRetake,
}: Props) {
  const [store, setStore] = useState(receipt.store)
  const [date, setDate] = useState(receipt.date)
  const [total, setTotal] = useState(String(receipt.total))
  const [rows, setRows] = useState<Row[]>(() =>
    receipt.items.map((item) => ({
      name: item.name,
      price: String(item.price),
      originalPrice: item.original_price,
    })),
  )

  // トップ5はクライアント側で値引き後金額の降順に並べて決める
  const top5 = useMemo(
    () =>
      rows
        .map((row) => ({ name: row.name.trim(), price: toNumber(row.price) }))
        .filter((row) => row.name !== '')
        .sort((a, b) => b.price - a.price)
        .slice(0, 5),
    [rows],
  )

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const totalValue = toNumber(total)
  const sumOfItems = rows.reduce((acc, row) => acc + toNumber(row.price), 0)

  return (
    <div className="screen">
      <h1>確認</h1>
      {error !== null && <p className="error">{error}</p>}

      <img className="preview" src={previewUrl} alt="撮影したレシート" />

      <div className="row">
        <label className="field">
          <span>日付</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>合計</span>
          <input
            type="number"
            inputMode="numeric"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>店名</span>
        <input value={store} onChange={(e) => setStore(e.target.value)} />
      </label>

      {sumOfItems !== totalValue && (
        <p className="note">
          商品の合計は {sumOfItems.toLocaleString()} 円です（合計欄との差 
          {(totalValue - sumOfItems).toLocaleString()} 円）。税や未読の行があると一致しません。
        </p>
      )}

      <h2>商品（{rows.length}件）</h2>
      <table className="items">
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                <input
                  aria-label={`商品名 ${index + 1}`}
                  value={row.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                />
              </td>
              <td className="price-cell">
                <input
                  aria-label={`金額 ${index + 1}`}
                  type="number"
                  inputMode="numeric"
                  value={row.price}
                  onChange={(e) => updateRow(index, { price: e.target.value })}
                />
                {row.originalPrice !== null && (
                  <span className="struck">{row.originalPrice.toLocaleString()}</span>
                )}
              </td>
              <td>
                <button
                  className="icon"
                  aria-label={`${index + 1}行目を削除`}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="ghost"
        onClick={() => setRows((prev) => [...prev, { name: '', price: '', originalPrice: null }])}
      >
        行を追加
      </button>

      <h2>送信されるトップ5</h2>
      <ol className="top5">
        {top5.map((item, index) => (
          <li key={index}>
            <span>{item.name}</span>
            <span className="amount">{item.price.toLocaleString()}円</span>
          </li>
        ))}
        {top5.length === 0 && <li className="note">商品がありません</li>}
      </ol>

      <button
        className="primary"
        disabled={submitting}
        onClick={() =>
          onSubmit({
            date,
            store: store.trim(),
            total: totalValue,
            top5: top5.map((item) => item.name),
          })
        }
      >
        {submitting ? '送信中…' : 'スプレッドシートに追記'}
      </button>
      <button className="ghost" disabled={submitting} onClick={onRetake}>
        撮り直す
      </button>
    </div>
  )
}

function toNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

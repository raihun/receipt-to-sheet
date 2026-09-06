import { useMemo, useState } from 'react'
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  defaultSubCategory,
  subCategoriesOf,
} from '../lib/categories'
import type { Category } from '../lib/categories'
import type { Receipt } from '../types'

type Row = { name: string; price: string; originalPrice: number | null }

type Props = {
  receipt: Receipt
  previewUrl: string
  submitting: boolean
  error: string | null
  onSubmit: (result: {
    date: string
    store: string
    total: number
    category: string
    subCategory: string
    top5: string
  }) => void
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
  // 送信直前の確認ダイアログ。費目と小項目はここで選ばせる（画面上部だと見落とすため）
  const [confirming, setConfirming] = useState(false)
  const [category, setCategory] = useState<Category>(DEFAULT_CATEGORY)
  const [subCategory, setSubCategory] = useState(defaultSubCategory(DEFAULT_CATEGORY))
  // 備考欄に入る文字列。null なら商品行から自動生成した値を使う
  const [note, setNote] = useState<string | null>(null)
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

  const autoNote = formatTop5(top5)
  const noteValue = note ?? autoNote

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
        <span>支払先</span>
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
      <label className="field">
        <span>備考欄に入る文字列</span>
        <textarea rows={3} value={noteValue} onChange={(e) => setNote(e.target.value)} />
      </label>
      {note !== null && note !== autoNote && (
        <button className="link left" onClick={() => setNote(null)}>
          商品行から作り直す
        </button>
      )}

      <button className="primary" onClick={() => setConfirming(true)}>
        スプレッドシートに追記
      </button>
      <button className="ghost" disabled={submitting} onClick={onRetake}>
        撮り直す
      </button>

      {confirming && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="追記の確認">
          <div className="sheet">
            <h2 className="sheet-title">この内容で追記します</h2>
            {error !== null && <p className="error">{error}</p>}

            <div className="row">
              <label className="field">
                <span>費目</span>
                <select
                  value={category}
                  onChange={(e) => {
                    const next = e.target.value as Category
                    setCategory(next)
                    setSubCategory(defaultSubCategory(next))
                  }}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>小項目</span>
                <select
                  value={subCategory}
                  disabled={subCategoriesOf(category).length === 0}
                  onChange={(e) => setSubCategory(e.target.value)}
                >
                  {subCategoriesOf(category).length === 0 ? (
                    <option value="">（なし）</option>
                  ) : (
                    subCategoriesOf(category).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <dl className="summary">
              <div>
                <dt>日付</dt>
                <dd>{date === '' ? '（未入力）' : date}</dd>
              </div>
              <div>
                <dt>金額</dt>
                <dd>¥{totalValue.toLocaleString()}</dd>
              </div>
              <div>
                <dt>支払先</dt>
                <dd>{store.trim() === '' ? '（未入力）' : store.trim()}</dd>
              </div>
              <div>
                <dt>備考</dt>
                <dd className="wrap">{noteValue === '' ? '（なし）' : noteValue}</dd>
              </div>
            </dl>

            <button
              className="primary"
              disabled={submitting}
              onClick={() =>
                onSubmit({
                  date,
                  store: store.trim(),
                  total: totalValue,
                  category,
                  subCategory,
                  top5: noteValue,
                })
              }
            >
              {submitting ? '送信中…' : `${category}${subCategory === '' ? '' : ' / ' + subCategory} で追記する`}
            </button>
            <button className="ghost" disabled={submitting} onClick={() => setConfirming(false)}>
              戻る
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** `商品名 1,234円` をカンマで連ねた1つの文字列にする。スプレッドシートでは1セルに入る */
function formatTop5(items: { name: string; price: number }[]): string {
  return items.map((item) => `${item.name} ${item.price.toLocaleString()}円`).join(', ')
}

function toNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

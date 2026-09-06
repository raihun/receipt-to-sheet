import type { Receipt } from '../types'

/**
 * 直近の解析結果を localStorage に置く簡易履歴。
 *
 * 用途は2つ。
 * - 過去の入力を確認・訂正する
 * - 開発時に毎回APIを叩かずに確認画面を再現する
 */

const KEY = 'receipt-to-sheet:history:v1'

export const HISTORY_LIMIT = 5

export type HistoryEntry = {
  id: string
  /** 解析した時刻（ISO） */
  savedAt: string
  /** デバッグ用。どのモデル・解像度で解析したか */
  model: string
  maxEdge: number
  receipt: Receipt
  /** 送信済みならその内容。未送信は null */
  submitted: {
    category: string
    subCategory: string
    top5: string
    message: string
  } | null
  /** 画像の base64。容量が足りないときは落とすので null になり得る */
  imageBase64: string | null
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
  } catch {
    // 壊れていたら履歴なし扱い。本体の動作は止めない
    return []
  }
}

type NewEntry = {
  receipt: Receipt
  model: string
  maxEdge: number
  imageBase64: string | null
}

/** 新しい順に HISTORY_LIMIT 件だけ残す */
export function addHistory(entry: NewEntry): HistoryEntry[] {
  const now = new Date()
  const added: HistoryEntry = {
    id: String(now.getTime()),
    savedAt: now.toISOString(),
    model: entry.model,
    maxEdge: entry.maxEdge,
    receipt: entry.receipt,
    submitted: null,
    imageBase64: entry.imageBase64,
  }
  return persist([added, ...loadHistory()].slice(0, HISTORY_LIMIT))
}

export function markSubmitted(id: string, submitted: HistoryEntry['submitted']): HistoryEntry[] {
  return persist(loadHistory().map((e) => (e.id === id ? { ...e, submitted } : e)))
}

export function clearHistory(): HistoryEntry[] {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 消せなくても続行する
  }
  return []
}

/**
 * 保存する。容量超過のときは古い画像から順に捨てて入るまで縮める。
 * 画像は1件あたり数十〜百数十KBで、5件でも1MB弱に収まる想定だが、
 * 保存できないときに履歴ごと失うより、画像を捨てて本文を残すほうがよい。
 */
function persist(list: HistoryEntry[]): HistoryEntry[] {
  let candidate = list
  for (let dropped = 0; dropped <= list.length; dropped++) {
    try {
      localStorage.setItem(KEY, JSON.stringify(candidate))
      return candidate
    } catch {
      // 後ろ（古い方）から画像を落として再挑戦する
      const target = candidate.length - 1 - dropped
      if (target < 0) break
      candidate = candidate.map((e, i) => (i === target ? { ...e, imageBase64: null } : e))
    }
  }
  return candidate
}

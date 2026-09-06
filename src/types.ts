export type ReceiptItem = {
  name: string
  /** 値引き後の金額。トップ5の並べ替えはこの値で行う */
  price: number
  /** 値引き前の金額。値引きが無い商品は null */
  original_price: number | null
}

export type Receipt = {
  store: string
  /** YYYY-MM-DD */
  date: string
  /** レシート下部の「合計」欄 */
  total: number
  items: ReceiptItem[]
}

export type Settings = {
  apiKey: string
  gasUrl: string
  passphrase: string
  /** 空文字なら DEFAULT_MODEL を使う */
  model: string
  /** 送信する画像の長辺ピクセル数 */
  maxEdge: number
}

/** GAS に送る本体。列構成は未決定なので、必要になりそうな値を素直に並べている */
export type SheetPayload = {
  passphrase: string
  date: string
  store: string
  total: number
  /** 値引き後金額の降順トップ5。商品名の文字列リスト */
  top5: string[]
}

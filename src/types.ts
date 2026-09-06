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

/** GAS に送る本体。1件が1行になる。列の割り当ては gas/Code.gs の buildRow */
export type SheetPayload = {
  passphrase: string
  /** A列。YYYY-MM-DD */
  date: string
  /** B列 */
  total: number
  /** C列。食費 / 日用品 / 特別費 */
  category: string
  /** D列。食費のときだけ 内食 / 中食 / 外食。それ以外は空文字 */
  subCategory: string
  /** E列 */
  store: string
  /** F列（備考）。例: `ｻｹ 798円, ﾌﾞﾀﾊﾞﾗ 682円` */
  top5: string
}

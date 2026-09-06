import { normalizeName } from './normalize'
import type { PreparedImage } from './image'
import type { Receipt, ReceiptItem } from '../types'

// Flash 系は無料枠の対象で、レシート程度の読み取りには十分。
// Google はモデルを短い周期で入れ替え、旧世代は新規ユーザーに 404 を返すようになる。
// 設定画面から上書きできるようにしてあるので、既定値が死んでもコード修正は不要。
export const DEFAULT_MODEL = 'gemini-3.8-flash'

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const SYSTEM_PROMPT = `あなたは日本のレシート画像を読み取って構造化する担当です。

読み取りの決まり:
- total はレシート下部の「合計」欄の金額（税込の支払額）。小計や預り金、釣銭ではない。
- items には購入した商品の行だけを入れる。小計・税額・値引き行そのもの・ポイント・釣銭・
  お預り・レジ番号・軽減税率の注記（※ や 軽 や ⑧ などの記号）は商品として扱わない。
- 日本のレシートは値引きが商品行の直下に別行で入る。
  例: 「ﾄﾞﾚｯｼﾝｸﾞ 298」の次行に「値引 -50」とある場合、その値引きは直前の商品のもの。
  この紐付けを行い、price には必ず値引き後の金額を入れる。上の例では price は 248、
  original_price は 298 になる。
- 値引きが無い商品は original_price を null にする。
- 数量がまとまった行（例: 「ﾄﾏﾄ 2点 @128 256」）は、その行の支払額 256 を price とする。
- 感熱紙の掠れで読めない文字は推測せず、読めた範囲の文字列をそのまま name に入れる。
- 軽減税率などの注記記号は name に含めない。商品名の前後に付く \`*\` \`＊\` \`※\` \`⑧\` や
  \`(軽)\` \`(内)\` \`(外)\` は落とす。ただし \`ﾎﾟﾃﾄ*2\` のような数量の掛け算表記は残す。
- 半角カタカナは全角カタカナに直す（\`ﾄﾞﾚｯｼﾝｸﾞ\` ではなく \`ドレッシング\`）。
- date が読み取れない場合は空文字にする。store も同様。
- 商品の並び順はレシートの記載順のままでよい。並べ替えはしない。`

const USER_PROMPT = 'このレシートを読み取ってください。'

// Gemini の responseSchema は OpenAPI のサブセット。型名は大文字、null 許容は nullable。
const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    store: { type: 'STRING', description: '店名。読めなければ空文字' },
    date: { type: 'STRING', description: 'YYYY-MM-DD 形式。読めなければ空文字' },
    total: { type: 'INTEGER', description: '合計欄の金額' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          price: { type: 'INTEGER', description: '値引き後の金額' },
          original_price: {
            type: 'INTEGER',
            nullable: true,
            description: '値引き前の金額。値引きが無ければ null',
          },
        },
        required: ['name', 'price'],
        propertyOrdering: ['name', 'price', 'original_price'],
      },
    },
  },
  required: ['store', 'date', 'total', 'items'],
  propertyOrdering: ['store', 'date', 'total', 'items'],
}

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] }
    finishReason?: string
  }[]
  promptFeedback?: { blockReason?: string }
  error?: { code?: number; message?: string; status?: string }
}

/** 503（過負荷）と429（枠超過）は時間を置けば直るので、その場でやり直す */
const MAX_ATTEMPTS = 4
const RETRYABLE = new Set([429, 500, 502, 503, 504])

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function analyzeReceipt(
  apiKey: string,
  image: PreparedImage,
  model: string,
  onProgress?: (message: string) => void,
): Promise<Receipt> {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: image.mediaType, data: image.base64 } },
          { text: USER_PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RECEIPT_SCHEMA,
      maxOutputTokens: 8192,
    },
  }

  let payload: GeminiResponse = {}

  for (let attempt = 1; ; attempt++) {
    let res: Response
    try {
      // キーはクエリではなくヘッダで送る。URL に載せると履歴やログに残る
      res = await fetch(endpointFor(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      })
    } catch (e) {
      console.error('Gemini request failed', e)
      throw new Error('Gemini APIに接続できませんでした。通信状態を確認してください')
    }

    payload = (await res.json().catch(() => ({}))) as GeminiResponse
    if (res.ok) break

    console.error('Gemini API error', res.status, payload)
    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) {
      throw new Error(describeHttpError(res.status, payload, model))
    }

    // 指数バックオフ。同時に再送が集中しないよう少しばらす
    const waitMs = 1000 * 2 ** (attempt - 1) + Math.random() * 500
    onProgress?.(`混み合っています。${Math.round(waitMs / 1000)}秒後に再試行します（${attempt}/${MAX_ATTEMPTS - 1}）`)
    await sleep(waitMs)
    onProgress?.('再試行中…')
  }

  if (payload.promptFeedback?.blockReason !== undefined) {
    throw new Error(`この画像の解析は拒否されました（${payload.promptFeedback.blockReason}）`)
  }

  const candidate = payload.candidates?.[0]
  if (candidate === undefined) {
    throw new Error('解析結果が空でした。もう一度撮影してください')
  }
  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new Error('レシートが長すぎて読み切れませんでした。分割して撮影してください')
  }
  if (candidate.finishReason !== undefined && candidate.finishReason !== 'STOP') {
    throw new Error(`解析が中断されました（${candidate.finishReason}）`)
  }

  const text = (candidate.content?.parts ?? []).map((part) => part.text ?? '').join('')
  return parseReceipt(text)
}

function describeHttpError(status: number, payload: GeminiResponse, model: string): string {
  const detail = payload.error?.message
  if (status === 400 && detail?.includes('API key') === true) {
    return 'APIキーが正しくありません。設定を確認してください'
  }
  if (status === 404) {
    // モデルの世代交代。API がたいてい後継の名前を教えてくれる
    return `モデル「${model}」が使えません。設定でモデル名を変えてください\n${detail ?? ''}`.trimEnd()
  }
  switch (status) {
    case 401:
    case 403:
      return 'APIキーが拒否されました。設定とキーの有効化状態を確認してください'
    case 429:
      return '無料枠の上限に達しました。しばらく待ってからもう一度試してください'
    case 500:
    case 502:
    case 503:
    case 504:
      return (
        'Gemini側が混み合っています。何度か再試行しましたが空きませんでした。\n' +
        '時間を置くか、設定で軽いモデル（例: gemini-3.5-flash-lite）に変えると通りやすくなります'
      )
    default:
      return `解析に失敗しました（HTTP ${status}）\n${detail ?? ''}`.trimEnd()
  }
}

function parseReceipt(text: string): Receipt {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('解析結果を読み取れませんでした。もう一度撮影してください')
  }

  const value = raw as Partial<Receipt>
  const items: ReceiptItem[] = Array.isArray(value.items)
    ? value.items
        .map((item) => ({
          name: normalizeName(item?.name),
          price: toInt(item?.price),
          original_price: item?.original_price == null ? null : toInt(item.original_price),
        }))
        .filter((item) => item.name !== '')
    : []

  return {
    store: normalizeName(value.store),
    date: typeof value.date === 'string' ? value.date : '',
    total: toInt(value.total),
    items,
  }
}

function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.round(n) : 0
}

import type { SheetPayload } from '../types'

/**
 * GAS のウェブアプリに追記を依頼する。
 *
 * Content-Type に application/json を指定すると preflight が飛び、GAS は OPTIONS に
 * 応答できず CORS エラーになる。text/plain で送り、GAS 側で JSON.parse すること。
 */
export async function appendToSheet(gasUrl: string, payload: SheetPayload): Promise<string> {
  let res: Response
  try {
    res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })
  } catch {
    throw new Error('スプレッドシートに接続できませんでした。GASのURLと通信状態を確認してください')
  }

  const text = (await res.text()).trim()
  if (!res.ok) {
    throw new Error(`スプレッドシートへの書き込みに失敗しました（HTTP ${res.status}）`)
  }

  // GAS 側の返却形式は自由。{ ok: false, error } を返してきたら失敗として扱う
  let parsed: unknown = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }

  if (parsed !== null && typeof parsed === 'object') {
    const body = parsed as { ok?: boolean; error?: string; message?: string }
    if (body.ok === false) {
      throw new Error(body.error ?? body.message ?? 'スプレッドシート側で拒否されました')
    }
    return body.message ?? '追記しました'
  }

  // HTML が返ってくるのは大抵 URL か公開設定の誤り
  if (text.startsWith('<')) {
    throw new Error('GASがHTMLを返しました。デプロイURL（/exec）と公開設定を確認してください')
  }

  return text === '' ? '追記しました' : text
}

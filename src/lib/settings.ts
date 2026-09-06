import { DEFAULT_MAX_EDGE } from './image'
import type { Settings } from '../types'

const KEY = 'receipt-to-sheet:settings:v2'

export const EMPTY_SETTINGS: Settings = {
  apiKey: '',
  gasUrl: '',
  passphrase: '',
  model: '',
  maxEdge: DEFAULT_MAX_EDGE,
}

/**
 * iOS では一定期間使われないサイトの localStorage が消える。
 * 読めない・壊れている場合は空扱いにして、設定画面に戻れるようにする。
 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      gasUrl: typeof parsed.gasUrl === 'string' ? parsed.gasUrl : '',
      passphrase: typeof parsed.passphrase === 'string' ? parsed.passphrase : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
      maxEdge:
        typeof parsed.maxEdge === 'number' && Number.isFinite(parsed.maxEdge)
          ? parsed.maxEdge
          : DEFAULT_MAX_EDGE,
    }
  } catch {
    return EMPTY_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // プライベートブラウズ等で書けないことがある。保存できなくても操作は続行させる
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 同上
  }
}

export function isConfigured(settings: Settings): boolean {
  return settings.apiKey !== '' && settings.gasUrl !== '' && settings.passphrase !== ''
}

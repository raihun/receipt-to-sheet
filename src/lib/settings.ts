import { DEFAULT_MAX_EDGE } from './image'
import type { Destination, Settings } from '../types'

const KEY = 'receipt-to-sheet:settings:v3'
/** 送信先が1つだけだった頃の保存内容。読めたら移行する */
const LEGACY_KEY = 'receipt-to-sheet:settings:v2'

export const EMPTY_SETTINGS: Settings = {
  destinations: [],
  selectedId: '',
  model: '',
  maxEdge: DEFAULT_MAX_EDGE,
}

export function newDestination(name = ''): Destination {
  return {
    id: `d${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name,
    apiKey: '',
    gasUrl: '',
    passphrase: '',
  }
}

/**
 * iOS では一定期間使われないサイトの localStorage が消える。
 * 読めない・壊れている場合は空扱いにして、設定画面に戻れるようにする。
 */
export function loadSettings(): Settings {
  const current = read(KEY)
  if (current !== null) return current

  const migrated = migrateFromLegacy()
  if (migrated !== null) {
    saveSettings(migrated)
    return migrated
  }
  return EMPTY_SETTINGS
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // プライベートブラウズ等で書けないことがある。保存できなくても操作は続行させる
  }
}

export function clearSettings(): Settings {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // 消せなくても続行する
  }
  return EMPTY_SETTINGS
}

export function selectedDestination(settings: Settings): Destination | null {
  return settings.destinations.find((d) => d.id === settings.selectedId) ?? null
}

export function isComplete(destination: Destination | null): destination is Destination {
  return (
    destination !== null &&
    destination.apiKey !== '' &&
    destination.gasUrl !== '' &&
    destination.passphrase !== ''
  )
}

/** 使える送信先が選ばれているか */
export function isConfigured(settings: Settings): boolean {
  return isComplete(selectedDestination(settings))
}

function read(key: string): Settings | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Settings>
    if (!Array.isArray(parsed.destinations)) return null
    const destinations = parsed.destinations.map((d) => ({
      id: typeof d?.id === 'string' && d.id !== '' ? d.id : newDestination().id,
      name: typeof d?.name === 'string' ? d.name : '',
      apiKey: typeof d?.apiKey === 'string' ? d.apiKey : '',
      gasUrl: typeof d?.gasUrl === 'string' ? d.gasUrl : '',
      passphrase: typeof d?.passphrase === 'string' ? d.passphrase : '',
    }))
    const selectedId =
      typeof parsed.selectedId === 'string' &&
      destinations.some((d) => d.id === parsed.selectedId)
        ? parsed.selectedId
        : (destinations[0]?.id ?? '')
    return {
      destinations,
      selectedId,
      model: typeof parsed.model === 'string' ? parsed.model : '',
      maxEdge:
        typeof parsed.maxEdge === 'number' && Number.isFinite(parsed.maxEdge)
          ? parsed.maxEdge
          : DEFAULT_MAX_EDGE,
    }
  } catch {
    return null
  }
}

/** 単一送信先だった v2 の内容を、送信先1件として引き継ぐ */
function migrateFromLegacy(): Settings | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const old = JSON.parse(raw) as Record<string, unknown>
    const apiKey = typeof old.apiKey === 'string' ? old.apiKey : ''
    const gasUrl = typeof old.gasUrl === 'string' ? old.gasUrl : ''
    const passphrase = typeof old.passphrase === 'string' ? old.passphrase : ''
    if (apiKey === '' && gasUrl === '' && passphrase === '') return null

    const destination: Destination = { ...newDestination('移行した設定'), apiKey, gasUrl, passphrase }
    return {
      destinations: [destination],
      selectedId: destination.id,
      model: typeof old.model === 'string' ? old.model : '',
      maxEdge:
        typeof old.maxEdge === 'number' && Number.isFinite(old.maxEdge)
          ? old.maxEdge
          : DEFAULT_MAX_EDGE,
    }
  } catch {
    return null
  }
}

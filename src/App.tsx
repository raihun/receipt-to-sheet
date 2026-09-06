import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzeReceipt, DEFAULT_MODEL } from './lib/gemini'
import { prepareImage } from './lib/image'
import type { PreparedImage } from './lib/image'
import { appendToSheet } from './lib/gas'
import { addHistory, clearHistory, loadHistory, markSubmitted } from './lib/history'
import type { HistoryEntry } from './lib/history'
import {
  clearSettings,
  isConfigured,
  loadSettings,
  saveSettings,
  selectedDestination,
} from './lib/settings'
import type { Receipt, Settings } from './types'
import { CaptureScreen } from './screens/CaptureScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { PreviewScreen } from './screens/PreviewScreen'
import { ConfirmScreen } from './screens/ConfirmScreen'
import { DoneScreen } from './screens/DoneScreen'
import { SettingsScreen } from './screens/SettingsScreen'

type Step = 'settings' | 'capture' | 'history' | 'preview' | 'analyzing' | 'confirm' | 'done'

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [step, setStep] = useState<Step>(() => (isConfigured(loadSettings()) ? 'capture' : 'settings'))
  const [image, setImage] = useState<PreparedImage | null>(null)
  // 解像度を変えて作り直すため、元の写真を保持しておく
  const [file, setFile] = useState<File | null>(null)
  const [resizing, setResizing] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')
  const [progress, setProgress] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  // 確認画面がどの履歴に対応するか。送信結果を書き戻すのに使う
  const [entryId, setEntryId] = useState<string | null>(null)
  // 確認画面のプレビュー。撮影直後は blob URL、履歴からは data URL
  const [confirmPreview, setConfirmPreview] = useState<string | null>(null)
  const [confirmOrigin, setConfirmOrigin] = useState<'capture' | 'history'>('capture')

  const destination = selectedDestination(settings)

  // blob URL の後片付け。撮り直しのたびに積み上がるのを防ぐ
  const previousUrl = useRef<string | null>(null)
  useEffect(() => {
    if (previousUrl.current !== null && previousUrl.current !== image?.previewUrl) {
      URL.revokeObjectURL(previousUrl.current)
    }
    previousUrl.current = image?.previewUrl ?? null
  }, [image])

  const handlePick = useCallback(
    async (picked: File) => {
      setError(null)
      setProgress('')
      try {
        const prepared = await prepareImage(picked, settings.maxEdge)
        setFile(picked)
        setImage(prepared)
        setStep('preview')
      } catch (e) {
        setError(e instanceof Error ? e.message : '画像を読み込めませんでした')
        setStep('capture')
      }
    },
    [settings.maxEdge],
  )

  /** 同じ写真から作り直す。撮り直さずに解像度を見比べるため */
  const handleChangeMaxEdge = useCallback(
    async (maxEdge: number) => {
      if (file === null) return
      const next = { ...settings, maxEdge }
      saveSettings(next)
      setSettings(next)
      setResizing(true)
      try {
        setImage(await prepareImage(file, maxEdge))
      } catch (e) {
        setError(e instanceof Error ? e.message : '画像を作り直せませんでした')
      } finally {
        setResizing(false)
      }
    },
    [file, settings],
  )

  const handleAnalyze = useCallback(async () => {
    if (image === null) return
    setError(null)
    setProgress('')
    setStep('analyzing')
    try {
      if (destination === null) {
        setError('送信先が選ばれていません。設定を確認してください')
        setStep('preview')
        return
      }
      const usedModel = settings.model === '' ? DEFAULT_MODEL : settings.model
      const result = await analyzeReceipt(destination.apiKey, image, usedModel, setProgress)
      const saved = addHistory({
        receipt: result,
        model: usedModel,
        maxEdge: settings.maxEdge,
        imageBase64: image.base64,
      })
      setHistory(saved)
      setEntryId(saved[0]?.id ?? null)
      setConfirmPreview(image.previewUrl)
      setConfirmOrigin('capture')
      setReceipt(result)
      setStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
      setStep('preview')
    }
  }, [image, destination, settings.model, settings.maxEdge])

  const handleSubmit = useCallback(
    async (result: {
      destinationId: string
      date: string
      store: string
      total: number
      category: string
      subCategory: string
      top5: string
    }) => {
      const target = settings.destinations.find((d) => d.id === result.destinationId)
      if (target === undefined) {
        setError('送信先が見つかりません。設定を確認してください')
        return
      }
      setSubmitting(true)
      setError(null)
      try {
        const { destinationId: _ignored, ...row } = result
        const message = await appendToSheet(target.gasUrl, {
          passphrase: target.passphrase,
          ...row,
        })
        setDoneMessage(message)
        if (entryId !== null) {
          setHistory(
            markSubmitted(entryId, {
              category: result.category,
              subCategory: result.subCategory,
              top5: result.top5,
              message,
            }),
          )
        }
        setStep('done')
      } catch (e) {
        setError(e instanceof Error ? e.message : '送信に失敗しました')
      } finally {
        setSubmitting(false)
      }
    },
    [settings.destinations, entryId],
  )

  /** 履歴から確認画面を再現する。APIは呼ばない */
  const openFromHistory = useCallback((entry: HistoryEntry) => {
    setReceipt(entry.receipt)
    setEntryId(entry.id)
    setConfirmPreview(
      entry.imageBase64 === null ? null : `data:image/jpeg;base64,${entry.imageBase64}`,
    )
    setImage(null)
    setFile(null)
    setError(null)
    setConfirmOrigin('history')
    setStep('confirm')
  }, [])

  const resetToCapture = useCallback(() => {
    setImage(null)
    setFile(null)
    setReceipt(null)
    setConfirmPreview(null)
    setEntryId(null)
    setError(null)
    setStep('capture')
  }, [])

  if (step === 'settings') {
    return (
      <SettingsScreen
        initial={settings}
        canCancel={isConfigured(settings)}
        onSave={(next) => {
          saveSettings(next)
          setSettings(next)
          setStep('capture')
        }}
        onCancel={() => setStep('capture')}
        onClear={() => setSettings(clearSettings())}
      />
    )
  }

  if (step === 'preview' && image !== null) {
    return (
      <>
        {error !== null && (
          <div className="screen">
            <p className="error">{error}</p>
          </div>
        )}
        <PreviewScreen
          image={image}
          maxEdge={settings.maxEdge}
          resizing={resizing}
          onChangeMaxEdge={handleChangeMaxEdge}
          onAnalyze={handleAnalyze}
          onRetake={resetToCapture}
        />
      </>
    )
  }

  if (step === 'analyzing') {
    return (
      <div className="screen center">
        <div className="spinner" />
        <h1>解析中…</h1>
        <p className="note">
          {progress === '' ? 'レシートの行数によっては十数秒かかります。' : progress}
        </p>
      </div>
    )
  }

  if (step === 'history') {
    return (
      <HistoryScreen
        entries={history}
        onOpen={openFromHistory}
        onClear={() => setHistory(clearHistory())}
        onBack={() => setStep('capture')}
      />
    )
  }

  if (step === 'confirm' && receipt !== null) {
    return (
      <ConfirmScreen
        // 履歴を切り替えたときに編集中の状態を持ち越さない
        key={entryId ?? 'fresh'}
        receipt={receipt}
        destinations={settings.destinations}
        selectedId={settings.selectedId}
        previewUrl={confirmPreview}
        origin={confirmOrigin}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        onBack={confirmOrigin === 'history' ? () => setStep('history') : resetToCapture}
      />
    )
  }

  if (step === 'done') {
    return <DoneScreen message={doneMessage} onNext={resetToCapture} />
  }

  return (
    <CaptureScreen
      error={error}
      destinationName={destination === null ? '未設定' : destination.name}
      historyCount={history.length}
      onPick={handlePick}
      onOpenHistory={() => setStep('history')}
      onOpenSettings={() => setStep('settings')}
    />
  )
}

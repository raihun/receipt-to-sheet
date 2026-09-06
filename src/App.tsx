import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzeReceipt, DEFAULT_MODEL } from './lib/gemini'
import { prepareImage } from './lib/image'
import type { PreparedImage } from './lib/image'
import { appendToSheet } from './lib/gas'
import { clearSettings, EMPTY_SETTINGS, isConfigured, loadSettings, saveSettings } from './lib/settings'
import type { Receipt, Settings } from './types'
import { CaptureScreen } from './screens/CaptureScreen'
import { PreviewScreen } from './screens/PreviewScreen'
import { ConfirmScreen } from './screens/ConfirmScreen'
import { DoneScreen } from './screens/DoneScreen'
import { SettingsScreen } from './screens/SettingsScreen'

type Step = 'settings' | 'capture' | 'preview' | 'analyzing' | 'confirm' | 'done'

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
      const result = await analyzeReceipt(
        settings.apiKey,
        image,
        settings.model === '' ? DEFAULT_MODEL : settings.model,
        setProgress,
      )
      setReceipt(result)
      setStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
      setStep('preview')
    }
  }, [image, settings.apiKey, settings.model])

  const handleSubmit = useCallback(
    async (result: { date: string; store: string; total: number; top5: string[] }) => {
      setSubmitting(true)
      setError(null)
      try {
        const message = await appendToSheet(settings.gasUrl, {
          passphrase: settings.passphrase,
          ...result,
        })
        setDoneMessage(message)
        setStep('done')
      } catch (e) {
        setError(e instanceof Error ? e.message : '送信に失敗しました')
      } finally {
        setSubmitting(false)
      }
    },
    [settings.gasUrl, settings.passphrase],
  )

  const resetToCapture = useCallback(() => {
    setImage(null)
    setFile(null)
    setReceipt(null)
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
        onClear={() => {
          clearSettings()
          setSettings(EMPTY_SETTINGS)
        }}
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

  if (step === 'confirm' && receipt !== null && image !== null) {
    return (
      <ConfirmScreen
        receipt={receipt}
        previewUrl={image.previewUrl}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        onRetake={resetToCapture}
      />
    )
  }

  if (step === 'done') {
    return <DoneScreen message={doneMessage} onNext={resetToCapture} />
  }

  return (
    <CaptureScreen error={error} onPick={handlePick} onOpenSettings={() => setStep('settings')} />
  )
}

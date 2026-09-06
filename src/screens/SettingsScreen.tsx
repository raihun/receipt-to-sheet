import { useState } from 'react'
import { DEFAULT_MODEL } from '../lib/gemini'
import type { Settings } from '../types'

type Props = {
  initial: Settings
  canCancel: boolean
  onSave: (settings: Settings) => void
  onCancel: () => void
  onClear: () => void
}

export function SettingsScreen({ initial, canCancel, onSave, onCancel, onClear }: Props) {
  const [apiKey, setApiKey] = useState(initial.apiKey)
  const [gasUrl, setGasUrl] = useState(initial.gasUrl)
  const [passphrase, setPassphrase] = useState(initial.passphrase)
  const [model, setModel] = useState(initial.model)

  const trimmed: Settings = {
    apiKey: apiKey.trim(),
    gasUrl: gasUrl.trim(),
    passphrase: passphrase.trim(),
    model: model.trim(),
    // 解像度はプレビュー画面で切り替えるので、ここでは現在値を持ち越すだけ
    maxEdge: initial.maxEdge,
  }
  const ready = trimmed.apiKey !== '' && trimmed.gasUrl !== '' && trimmed.passphrase !== ''

  return (
    <div className="screen">
      <h1>設定</h1>
      <p className="note">
        この端末の localStorage に保存します。ホーム画面のアプリとSafariは別扱いなので、
        それぞれで入力が必要です。
      </p>

      <label className="field">
        <span>Gemini APIキー</span>
        <input
          type="password"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="AIza..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </label>

      <label className="field">
        <span>GASウェブアプリのURL</span>
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://script.google.com/macros/s/.../exec"
          value={gasUrl}
          onChange={(e) => setGasUrl(e.target.value)}
        />
      </label>

      <label className="field">
        <span>合言葉</span>
        <input
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
      </label>

      <label className="field">
        <span>モデル（空欄なら {DEFAULT_MODEL}）</span>
        <input
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={DEFAULT_MODEL}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </label>
      <p className="note">
        Geminiのモデルは入れ替わりが早く、古い世代は404になります。そうなったらエラー文に
        後継の名前が出るので、ここに入れ直してください。
      </p>

      <button className="primary" disabled={!ready} onClick={() => onSave(trimmed)}>
        保存
      </button>
      {canCancel && (
        <button className="ghost" onClick={onCancel}>
          戻る
        </button>
      )}
      <button className="danger" onClick={onClear}>
        保存内容を消す
      </button>
    </div>
  )
}

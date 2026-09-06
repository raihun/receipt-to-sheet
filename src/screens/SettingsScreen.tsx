import { useState } from 'react'
import { DEFAULT_MODEL } from '../lib/gemini'
import { isComplete, newDestination } from '../lib/settings'
import type { Destination, Settings } from '../types'

type Props = {
  initial: Settings
  canCancel: boolean
  onSave: (settings: Settings) => void
  onCancel: () => void
  onClear: () => void
}

export function SettingsScreen({ initial, canCancel, onSave, onCancel, onClear }: Props) {
  const [destinations, setDestinations] = useState<Destination[]>(() =>
    initial.destinations.length === 0 ? [newDestination('家族共用')] : initial.destinations,
  )
  const [selectedId, setSelectedId] = useState(
    () => initial.selectedId || destinations[0]?.id || '',
  )
  const [model, setModel] = useState(initial.model)
  const [openId, setOpenId] = useState<string | null>(() => destinations[0]?.id ?? null)

  const update = (id: string, patch: Partial<Destination>) => {
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  const add = () => {
    const created = newDestination('')
    setDestinations((prev) => [...prev, created])
    setOpenId(created.id)
  }

  const remove = (id: string) => {
    setDestinations((prev) => {
      const next = prev.filter((d) => d.id !== id)
      if (id === selectedId) setSelectedId(next[0]?.id ?? '')
      return next
    })
  }

  const trimmed: Settings = {
    destinations: destinations.map((d) => ({
      ...d,
      name: d.name.trim(),
      apiKey: d.apiKey.trim(),
      gasUrl: d.gasUrl.trim(),
      passphrase: d.passphrase.trim(),
    })),
    selectedId,
    model: model.trim(),
    maxEdge: initial.maxEdge, // 解像度はプレビュー画面で切り替える
  }

  const selected = trimmed.destinations.find((d) => d.id === selectedId) ?? null
  const ready = isComplete(selected) && selected.name !== ''

  return (
    <div className="screen">
      {canCancel && (
        <div className="topbar">
          <button className="link left" onClick={onCancel}>
            ← ホームに戻る
          </button>
        </div>
      )}
      <h1>設定</h1>
      <p className="note">
        この端末の localStorage に保存します。ホーム画面のアプリとSafariは別扱いなので、
        端末ごと、追加方法ごとに入力が必要です。
      </p>

      <h2>送信先</h2>
      <p className="note">
        スプレッドシートごとに1つ作ります。使うものをラジオボタンで選んでください。
        送信直前の確認ダイアログでも切り替えられます。
      </p>

      {trimmed.destinations.length === 0 && (
        <p className="note">送信先がありません。「送信先を追加」から作ってください。</p>
      )}

      {destinations.map((destination) => {
        const complete = isComplete(
          trimmed.destinations.find((d) => d.id === destination.id) ?? null,
        )
        return (
          <div className="card" key={destination.id}>
            <div className="card-head">
              <label className="pick">
                <input
                  type="radio"
                  name="selected"
                  checked={destination.id === selectedId}
                  onChange={() => setSelectedId(destination.id)}
                />
                <span className="card-title">
                  {destination.name.trim() === '' ? '（名前なし）' : destination.name}
                </span>
              </label>
              <span className={complete ? 'sent' : 'pending'}>{complete ? '設定済' : '未完'}</span>
            </div>

            <div className="seg">
              <button
                className="seg-item"
                onClick={() => setOpenId((id) => (id === destination.id ? null : destination.id))}
              >
                {openId === destination.id ? '閉じる' : '編集'}
              </button>
              <button className="seg-item" onClick={() => remove(destination.id)}>
                削除
              </button>
            </div>

            {openId === destination.id && (
              <>
                <label className="field">
                  <span>名前</span>
                  <input
                    placeholder="家族共用 / 個人 など"
                    value={destination.name}
                    onChange={(e) => update(destination.id, { name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Gemini APIキー</span>
                  <input
                    type="password"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="AIza..."
                    value={destination.apiKey}
                    onChange={(e) => update(destination.id, { apiKey: e.target.value })}
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
                    value={destination.gasUrl}
                    onChange={(e) => update(destination.id, { gasUrl: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>合言葉</span>
                  <input
                    type="password"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={destination.passphrase}
                    onChange={(e) => update(destination.id, { passphrase: e.target.value })}
                  />
                </label>
              </>
            )}
          </div>
        )
      })}

      <button className="ghost" onClick={add}>
        送信先を追加
      </button>

      <h2>共通設定</h2>
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
      {!ready && (
        <p className="note">
          選択中の送信先に、名前・APIキー・URL・合言葉のすべてが入っていると保存できます。
        </p>
      )}
      <button className="danger" onClick={onClear}>
        保存内容を消す
      </button>
    </div>
  )
}

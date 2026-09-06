# レシート入力PWA

## 目的

スマホでレシートを撮影し、Gemini APIで解析して、確認画面を経てGoogleスプレッドシートに行追加する。

想定利用者は数名規模の私的利用。App Storeを介さず、GitHub Pages（`*.github.io`）で配布し、ホーム画面に追加して使う。

この規模を前提に、ログイン機構は持たず、書き込みの認可は合言葉1つで済ませている。

## 出力仕様

1. 合計金額（レシート下部の「合計」欄）
2. 割引後の金額が高い順に、商品トップ5の文字列リスト

## アーキテクチャ

- 静的サイトのみ。バックエンドサーバは持たない
- Gemini API はブラウザから直接呼ぶ（BYOK方式）
- APIキーはユーザーが画面から入力し、`localStorage` に保存する
- スプレッドシート書き込みは Google Apps Script のウェブアプリを経由する

```
iPhone (PWA)
  ├─ 撮影 → 長辺1500pxにリサイズ → base64
  ├─ Gemini API 直叩き（x-goog-api-key は localStorage）
  ├─ 確認・編集画面
  └─ GAS /exec に POST → appendRow
```

解析クライアントは `src/lib/gemini.ts` に閉じている。プロバイダを差し替える場合は
このファイルの `analyzeReceipt` の入出力（`PreparedImage` → `Receipt`）を保てば
他の画面に影響しない。

## 技術スタック

- ビルド: Vite
- UI: React + TypeScript
- デプロイ: GitHub Actions → GitHub Pages
- 状態管理: 追加ライブラリ不要。`useState` で足りる規模

`vite.config.ts` の `base` はリポジトリ名に合わせること（例: `base: '/receipt-app/'`）。ここを忘れるとPages上でアセットが404になる。

## 重要な制約

### LLM APIの選定理由（CORS）

バックエンドを持たない構成では、ブラウザからのCORSを許可しているAPIしか選べない。
`http://localhost:5173` から実測した結果:

| 呼び先 | preflight (OPTIONS) | 可否 |
|---|---|---|
| `generativelanguage.googleapis.com`（Gemini） | 通過 | **使える** |
| `api.anthropic.com`（Claude） | 通過 | 使える（`anthropic-dangerous-direct-browser-access: true` が必須） |
| `api.openai.com`（OpenAI） | 拒否 | **使えない** |

OpenAI は `Authorization` ヘッダが必須なので preflight が避けられず、その OPTIONS に
`Access-Control-Allow-Origin` を返さない。`openai` SDK の `dangerouslyAllowBrowser` は
キー露出の警告を外すだけでCORSは解決しないため、この構成では選択肢にならない。
使いたい場合はGASなどサーバ側を経由させる必要がある。

Gemini はキーをクエリ（`?key=`）でもヘッダでも受けるが、URLに載せると履歴やログに
残るのでヘッダで送る。`x-goog-api-key` はカスタムヘッダなのでpreflightが飛ぶが、
Google側が許可しているので通る（実測済み）。

### GAS の CORS

`Content-Type: application/json` を明示するとpreflight（OPTIONS）が発生し、GASは応答できずCORSエラーになる。

`text/plain` で送信し、GAS側の `doPost` で `JSON.parse(e.postData.contents)` すること。

### localStorage の揮発

iOSでは一定期間使われないサイトのスクリプト書き込みストレージが削除されることがある。APIキーが消えていても壊れず、設定画面に戻る作りにする。

ホーム画面PWAとSafariはストレージが別。端末ごと、追加方法ごとに初回設定が必要。

### 撮影

```html
<input type="file" accept="image/*" capture="environment">
```

送信前に canvas で長辺をリサイズする。トークン量と待ち時間を抑えるため。既定は1500px。

解像度はプレビュー画面から 1000 / 1500 / 2000 / 2500 を選べる（`MAX_EDGE_CHOICES`）。
元の `File` を保持しているので、撮り直さずに切り替えて見比べられる。実測値の目安:

| 長辺 | 実寸の例 | JPEG |
|---|---|---|
| 1000px | 706 × 1000 | 33 KB |
| 1500px | 1059 × 1500 | 55 KB |
| 2500px | 1765 × 2500 | 116 KB |

解像度を下げるとトークン量と待ち時間が減るので **429（無料枠の上限）** には効くが、
**503（モデル過負荷）** には効かない。503はGemini側の容量不足なので、自動リトライか
軽いモデルへの変更で対処する。

## 画面構成

1. **設定** — APIキー、GASのURL、合言葉を入力。localStorageに保存
2. **撮影** — カメラ起動
3. **プレビュー** — 送信される画像を**等倍で**表示。実寸px と KB を出し、解像度を切り替えて見比べられる。ここを通さずに解析させないこと（掠れて読めない写真でAPIを消費するのを防ぐ）
4. **解析中** — ローディング。リトライ中はその旨を表示する
5. **確認** — 商品名・金額を編集可能なテーブルで表示。トップ5と合計金額を確認。誤りを手で直せること（**必須**。感熱紙の掠れや軽減税率の注記を誤って拾うことがある）
6. **完了** — 送信結果の表示

プレビューを等倍で見せるのが要点。`object-fit: contain` で枠に収めると、実際に送られる
解像度で文字が読めるかどうかが判断できない。viewport で `user-scalable=no` にしている
ためピンチ拡大が使えないので、枠内スクロール（`.zoom-frame`）で代替している。

## Gemini API プロンプト方針

レシート画像を渡し、JSONのみを返させる。プロンプトで「JSONだけ返せ」と頼むのではなく、
`generationConfig.responseMimeType: 'application/json'` と `responseSchema` で構造を
強制する。前置きやコードフェンスが混ざる余地をなくすため。

`responseSchema` はOpenAPIのサブセット。型名は大文字（`OBJECT` / `STRING` / `INTEGER` /
`ARRAY`）で、null許容は `type` の配列ではなく `nullable: true` で表す。JSON Schemaの
書き方をそのまま持ち込むと400になる。

Googleが推奨してくる Interactions API は別surfaceで、構造化出力の指定が
`response_format: { type, mime_type, schema }`（型名は小文字、null許容は型の配列）と
まるごと違う。generateContent を使う限りは上記の書き方が正しい。混同しないこと。

### モデルの入れ替わり

Geminiはモデルの世代交代が早く、旧世代は**新規ユーザーに404を返す**ようになる
（`gemini-2.5-flash` で実際に踏んだ）。404の本文で後継モデル名を教えてくれる。

既定値は `src/lib/gemini.ts` の `DEFAULT_MODEL`。加えて設定画面から上書きできるので、
次に世代交代してもコード修正と再デプロイをせずに復帰できる。間隔をあけて使う想定の
アプリなので、この経路は残しておくこと。

日本のレシートは値引きが商品行の直下に別行で入る（例: `ﾄﾞﾚｯｼﾝｸﾞ 298` の次行に `値引 -50`）。この紐付けを含めて解析させ、**値引き後の金額**を各商品の価格として返させること。

返却スキーマ:

```json
{
  "store": "店名",
  "date": "YYYY-MM-DD",
  "total": 3980,
  "items": [
    { "name": "商品名", "price": 248, "original_price": 298 }
  ]
}
```

トップ5の抽出はクライアント側で `price` の降順ソートで行う。LLMには並べ替えさせない。

## セキュリティ方針

- APIキーはリポジトリに絶対にコミットしない。`.gitignore` と、ハードコードされていないことの確認
- サードパーティのスクリプトタグを入れない（XSS経路を作らない）
- GASのURLは実質的な秘密情報。加えて合言葉を1つ検証させる
- Google AI Studio / Google Cloud 側で利用上限を設定しておく（最後の砦）。
  無料枠内で使う想定だが、枠を越えた場合に無制限に課金されない状態にしておくこと

## 未決定

- GAS側のスクリプト本体（PWA完成後に着手）
- スプレッドシートの列構成

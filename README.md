# レシート入力PWA

レシートを撮影し、Gemini API で解析して、確認画面を経て Google スプレッドシートに追記する。
仕様は [CLAUDE.md](./CLAUDE.md) を参照。

## 開発（Docker のみ。ホストに Node は不要）

```sh
docker compose up            # http://localhost:5173/receipt-to-sheet/
docker compose down
```

`node_modules` は名前付きボリュームに置いているので、ホストのリポジトリには生えない。
依存を追加するときもコンテナ内で実行する。

そのため**ホストのエディタからは型が解決できず、赤波線が出る**（コードは正しい。
コンテナ内の `tsc -b` はエラー0）。VSCode で補完を効かせたい場合は Dev Containers 拡張で
`.devcontainer/devcontainer.json` を使ってコンテナ内で開く。

```sh
docker compose run --rm --no-deps app npm install <package>
```

## 型チェックとビルド

```sh
docker compose run --rm --no-deps app npm run build
```

`dist/` が生成される。中身の確認は `docker compose run --rm --service-ports app npm run preview`。

## 実機（iPhone）での確認

`docker compose up` した状態で、同じ Wi-Fi の iPhone から
`http://<MacのIP>:5173/receipt-to-sheet/` を開く。

ただしカメラ起動（`capture="environment"`）と localStorage は HTTP でも動くが、
本番同様の確認をしたいときは GitHub Pages にデプロイした URL を使うのが早い。

## デプロイ

`main` への push で GitHub Actions が Pages に配信する（`.github/workflows/deploy.yml`）。
リポジトリの Settings → Pages → Source を **GitHub Actions** にしておくこと。

`vite.config.ts` の `base` はリポジトリ名（`/receipt-to-sheet/`）と一致させる。

## アイコン

`public/*.png` は `scripts/gen-icons.mjs` が生成する。差し替えたいときは:

```sh
docker compose run --rm --no-deps app node scripts/gen-icons.mjs
```

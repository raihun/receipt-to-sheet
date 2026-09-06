# 開発・ビルド用。ホストに Node を入れずに完結させるためのイメージ。
FROM node:22-alpine

WORKDIR /app

# node_modules は名前付きボリュームに載せる（compose.yaml 参照）ので、
# ここでは依存のインストールをせず、素の実行環境だけ用意する。
EXPOSE 5173 4173

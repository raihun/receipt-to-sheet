/**
 * レシートから読み取った文字列の整形。
 *
 * プロンプトでも指示しているが、LLMは取りこぼすので確定的に処理する。
 */

/** 丸数字は NFKC で ⑧ → 8 になってしまうので、正規化より前に落とす */
const CIRCLED_MARKERS = /[①-⓿]/g

/** 軽減税率などの注記。括弧付きのもの */
const TAX_NOTES = /[（(]\s*(?:軽減税率|軽減|軽|内税|外税|内|外|税)\s*[)）]/g

/**
 * 先頭・末尾の記号。軽減税率の印としてこの位置に付く。
 * 語中の `*` は残す（`ﾎﾟﾃﾄ*2` のような数量表記を壊さないため）。
 */
const EDGE_MARKERS = /^[\s*＊※・,，.。]+|[\s*＊※・,，.。]+$/g

/**
 * 商品名を整形する。
 *
 * - 半角カタカナを全角にする（`ﾄﾞﾚｯｼﾝｸﾞ` → `ドレッシング`。濁点も合成される）
 * - 全角英数を半角にする（`１Ｌ` → `1L`）
 * - 軽減税率の記号を落とす（`*`、`＊`、`※`、`⑧`、`(軽)`）
 * - 連続する空白を1つにまとめて前後を削る
 */
export function normalizeName(raw: unknown): string {
  return String(raw ?? '')
    .replace(CIRCLED_MARKERS, '')
    .replace(TAX_NOTES, '')
    .normalize('NFKC')
    .replace(EDGE_MARKERS, '')
    .replace(/\s+/g, ' ')
    .trim()
}

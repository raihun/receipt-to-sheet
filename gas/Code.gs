/**
 * レシート入力PWA から1件を受け取って、既存の家計簿スプレッドシートに書き込む。
 *
 * セットアップ手順は gas/README.md を参照。
 * 合言葉はスクリプトプロパティ PASSPHRASE に入れる。ここに書かないこと。
 *
 * 重要: 行の挿入はしない。整形済み（ドロップダウンと検索キーの数式が入った）行が
 * 下方に用意されているので、A列が空いている最初の行を探してそこに上書きする。
 * appendRow は使えない。H〜J列に数式が下まで入っているため getLastRow() が実データより
 * 遥か下を指し、整形済み範囲の外に書き込んでしまう。
 */

/** 書き込む列は A〜F の6列だけ。G以降（検索キーの数式）には触らない */
const FIRST_COLUMN = 1
const COLUMN_COUNT = 6
const HEADER_ROWS = 1

function doPost(e) {
  try {
    // PWA は preflight を避けるため text/plain で送ってくる。自分で JSON に戻す
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'リクエストが空です' })
    }

    const body = JSON.parse(e.postData.contents)

    const props = PropertiesService.getScriptProperties()
    const expected = props.getProperty('PASSPHRASE')
    if (!expected) {
      return json({ ok: false, error: 'サーバ側の合言葉が未設定です' })
    }
    if (body.passphrase !== expected) {
      return json({ ok: false, error: '合言葉が違います' })
    }

    if (!isFinite(Number(body.total))) {
      return json({ ok: false, error: '合計金額が数値ではありません' })
    }

    const book = targetBook(props)
    if (!book) {
      return json({
        ok: false,
        error:
          'スプレッドシートを開けません。スタンドアロンのスクリプトなら ' +
          'スクリプトプロパティ SPREADSHEET_ID を設定してください',
      })
    }

    const name = props.getProperty('SHEET_NAME')
    const sheet = name ? book.getSheetByName(name) : book.getSheets()[0]
    if (!sheet) {
      return json({ ok: false, error: 'シート（タブ）「' + name + '」が見つかりません' })
    }

    const row = firstEmptyRowByColumnA(sheet)
    if (!row) {
      return json({
        ok: false,
        error: 'A列に空き行がありません。整形済みの行をシート側で追加してください',
      })
    }

    sheet.getRange(row, FIRST_COLUMN, 1, COLUMN_COUNT).setValues([buildRow(body)])

    return json({ ok: true, message: row + '行目に書き込みました' })
  } catch (err) {
    // 例外の内容をそのまま返す。少人数の私的利用なので、隠すより追える方が有益
    return json({ ok: false, error: String(err) })
  }
}

/**
 * 1行分の値。左から A B C D E F の順。
 *
 * | A 日付 | B 金額 | C 費目 | D 小項目 | E 支払先 | F 備考 |
 */
function buildRow(body) {
  return [
    toDate(body.date),
    Number(body.total),
    String(body.category || ''),
    String(body.subCategory || ''),
    String(body.store || ''),
    String(body.top5 || ''),
  ]
}

/**
 * A列が空いている最初の行を返す。空きが無ければ null。
 *
 * 「最終行の次」ではない点が要。H〜J列には数式が下まで入っているので、
 * データの終わりはA列だけで判断する。
 */
function firstEmptyRowByColumnA(sheet) {
  const start = HEADER_ROWS + 1
  const rows = sheet.getMaxRows() - HEADER_ROWS
  if (rows < 1) return null

  const values = sheet.getRange(start, 1, rows, 1).getValues()
  for (let i = 0; i < values.length; i++) {
    const cell = values[i][0]
    if (cell === '' || cell === null) return start + i
  }
  return null
}

/**
 * `YYYY-MM-DD` を Date にする。列の書式（2026/09/05）で表示され、日付として並び替えできる。
 * 文字列のまま入れると解釈がロケール依存になるので、ここで組み立てる。
 * UTCではなくローカルで作る（new Date('2026-09-05') はUTC扱いで前日にずれる）。
 */
function toDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!m) return String(value || '') // 読み取れなかった場合はそのまま入れて手で直す
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * 追記先のスプレッドシートを返す。
 *
 * スプレッドシートから「拡張機能 → Apps Script」で作った場合は紐づいているので
 * getActiveSpreadsheet() で取れる。GASのページから単体で作った場合（スタンドアロン）は
 * それが null になるため、スクリプトプロパティ SPREADSHEET_ID で開く。
 * IDはプロパティに置くので、このスクリプトを公開リポジトリに置いても支障はない。
 */
function targetBook(props) {
  const id = props.getProperty('SPREADSHEET_ID')
  if (id) return SpreadsheetApp.openById(id)
  return SpreadsheetApp.getActiveSpreadsheet()
}

/** デプロイできているかの確認用。URLを知らない相手には何も渡らない */
function doGet() {
  return json({ ok: true })
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  )
}

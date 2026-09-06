// 依存なしで PNG を書き出す。アイコンのためだけにライブラリを増やしたくないため。
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, paint) {
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4) // 先頭 1 バイトはフィルタ種別 (0 = None)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x / size, y / size)
      row.set([r, g, b, 255], 1 + x * 4)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [0x1f, 0x6f, 0x4a]
const PAPER = [0xf7, 0xf7, 0xf4]
const INK = [0x9a, 0xa5, 0xa0]

// 緑地に白いレシート、横線 3 本。
const paint = (u, v) => {
  const inPaper = u > 0.28 && u < 0.72 && v > 0.16 && v < 0.84
  if (!inPaper) return BG
  const lines = [0.32, 0.46, 0.6]
  for (const ly of lines) {
    if (v > ly && v < ly + 0.05 && u > 0.36 && u < 0.64) return INK
  }
  if (v > 0.7 && v < 0.77 && u > 0.36 && u < 0.55) return INK
  return PAPER
}

for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size, paint))
  console.log('wrote', name)
}

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const iconsDir = join(__dirname, '../public/icons')

const sizes = [16, 48, 128]
const palette = {
  background: [33, 150, 243], // blue
  accent: [21, 101, 192],
  highlight: [255, 255, 255]
}

function ensureDirectory() {
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true })
  }
}

function blend(colorA, colorB, ratio) {
  return colorA.map((value, index) =>
    Math.round(value * (1 - ratio) + colorB[index] * ratio)
  )
}

function createIcon(size) {
  const png = new PNG({ width: size, height: size })
  const center = size / 2
  const radius = Math.max(2, Math.floor(size * 0.42))

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2
      const dx = x - center + 0.5
      const dy = y - center + 0.5
      const distance = Math.sqrt(dx * dx + dy * dy)
      const normalized = Math.min(distance / radius, 1)
      const color = blend(palette.background, palette.accent, normalized)
      png.data[idx] = color[0]
      png.data[idx + 1] = color[1]
      png.data[idx + 2] = color[2]
      png.data[idx + 3] = 255
    }
  }

  // simple "ai" monogram dots
  const dotRadius = Math.max(1, Math.floor(size * 0.08))
  const dotOffset = Math.floor(size * 0.22)
  const dots = [
    [center - dotOffset, center - dotOffset / 2],
    [center + dotOffset / 2, center + dotOffset / 3]
  ]
  for (const [cx, cy] of dots) {
    for (let y = -dotRadius; y <= dotRadius; y += 1) {
      for (let x = -dotRadius; x <= dotRadius; x += 1) {
        if (x * x + y * y <= dotRadius * dotRadius) {
          const px = Math.round(cx + x)
          const py = Math.round(cy + y)
          if (px >= 0 && py >= 0 && px < size && py < size) {
            const idx = (size * py + px) << 2
            png.data[idx] = palette.highlight[0]
            png.data[idx + 1] = palette.highlight[1]
            png.data[idx + 2] = palette.highlight[2]
            png.data[idx + 3] = 255
          }
        }
      }
    }
  }

  const buffer = PNG.sync.write(png)
  writeFileSync(join(iconsDir, `icon${size}.png`), buffer)
}

export function ensureIcons() {
  ensureDirectory()
  for (const size of sizes) {
    if (!existsSync(join(iconsDir, `icon${size}.png`))) {
      createIcon(size)
    }
  }
}

if (import.meta.url === `file://${__filename}`) {
  ensureIcons()
}

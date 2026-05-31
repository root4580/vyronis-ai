import { readFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

const root = join(import.meta.dirname, "..")
const svgPath = join(root, "public", "og-image.svg")
const pngPath = join(root, "public", "og-image.png")

async function main() {
  const svg = readFileSync(svgPath)

  await sharp(svg, { density: 144 })
    .resize(1200, 630)
    .png()
    .toFile(pngPath)

  console.log(`Wrote ${pngPath} (1200×630)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

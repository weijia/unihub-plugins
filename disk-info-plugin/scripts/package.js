import archiver from 'archiver'
import { createWriteStream } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const distDir = join(__dirname, '../dist')
const outputPath = join(__dirname, '../plugin.zip')

if (!existsSync(distDir)) {
  console.error('Error: dist directory not found. Please run "npm run build" first.')
  process.exit(1)
}

const output = createWriteStream(outputPath)
const archive = archiver('zip', {
  zlib: { level: 9 }
})

output.on('close', () => {
  console.log(`Plugin packaged successfully: ${outputPath}`)
  console.log(`Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`)
})

archive.on('error', (err) => {
  throw err
})

archive.pipe(output)

archive.directory(distDir, 'dist')
archive.file(join(__dirname, '../package.json'), { name: 'package.json' })

archive.finalize()
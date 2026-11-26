/**
 * Build dist/aitopo.iife.js from the public package entry (`src/index.ts`).
 * Global name: `Aitopo`. Never hand-edit the output; re-run this script.
 *
 * Skill hosts that need the slim contract should keep using
 * `pnpm run bundle:topo-diagram-skill` instead.
 */
import { build } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(repoRoot, 'dist')
const outFile = path.join(outDir, 'aitopo.iife.js')
const entry = path.join(repoRoot, 'src/index.ts')

const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
let gitSha = 'unknown'
try {
  gitSha = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
} catch {
  // keep unknown
}

const packedAt = new Date().toISOString()

mkdirSync(outDir, { recursive: true })

await build({
  configFile: false,
  root: repoRoot,
  logLevel: 'warn',
  build: {
    lib: {
      entry,
      name: 'Aitopo',
      formats: ['iife'],
      fileName: () => 'aitopo.iife.js',
    },
    outDir,
    emptyOutDir: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
  },
})

const body = readFileSync(outFile, 'utf8')
const header = [
  '/*!',
  ` * @neuravoxel/aitopo IIFE bundle`,
  ` * engine: @neuravoxel/aitopo@${pkg.version}`,
  ` * git: ${gitSha}`,
  ` * packed: ${packedAt}`,
  ` * entry: src/index.ts (full public API)`,
  ` * global: Aitopo`,
  ` * Do not hand-edit. Regenerate: pnpm run bundle:iife`,
  ' */',
  '',
].join('\n')

writeFileSync(outFile, header + body)
console.log(
  `wrote ${path.relative(repoRoot, outFile)} (${(body.length / 1024).toFixed(1)} KiB body)`,
)

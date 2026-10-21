/**
 * Build assets/aitopo.iife.js from the host-contract entry.
 * Never hand-edit the output; re-run this script instead.
 */
import { build } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(skillRoot, '../../..')
const outDir = path.join(skillRoot, 'assets')
const outFile = path.join(outDir, 'aitopo.iife.js')
const entry = path.join(skillRoot, 'scripts/bundle-entry.ts')

const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
let gitSha = 'unknown'
try {
  gitSha = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
} catch {
  // keep unknown
}

const packedAt = new Date().toISOString()
const contract = [
  'Network',
  'parseDocument',
  'CreateEdgeInteraction',
  'layoutGrid',
  'layoutFlowColumns',
]

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
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    target: 'es2022',
  },
})

const body = readFileSync(outFile, 'utf8')
const header = [
  '/*!',
  ` * topo-diagram skill — aitopo IIFE bundle`,
  ` * engine: @neuravoxel/aitopo@${pkg.version}`,
  ` * git: ${gitSha}`,
  ` * packed: ${packedAt}`,
  ` * contract: ${contract.join(', ')}`,
  ` * Do not hand-edit. Regenerate: pnpm run bundle:topo-diagram-skill`,
  ' */',
  '',
].join('\n')

writeFileSync(outFile, header + body)
console.log(`wrote ${path.relative(repoRoot, outFile)} (${(body.length / 1024).toFixed(1)} KiB body)`)

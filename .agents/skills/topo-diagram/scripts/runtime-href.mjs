#!/usr/bin/env node
/**
 * Compute relative hrefs from a diagram folder to the skill shared runtime assets.
 *
 * Usage:
 *   node runtime-href.mjs <diagram-dir>
 *   node runtime-href.mjs <diagram-dir> --skill-root <path-to-topo-diagram>
 *
 * Prints JSON: { assets, iife, host, exportDiagram }
 * Default skill root: this script's parent skill directory.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultSkillRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const args = { diagramDir: undefined, skillRoot: defaultSkillRoot }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--skill-root') {
      args.skillRoot = path.resolve(argv[++i] ?? '')
      continue
    }
    if (a.startsWith('-')) {
      throw new Error(`unknown flag: ${a}`)
    }
    if (args.diagramDir === undefined) args.diagramDir = path.resolve(a)
    else throw new Error('unexpected argument: ' + a)
  }
  if (args.diagramDir === undefined) {
    throw new Error('usage: runtime-href.mjs <diagram-dir> [--skill-root <skill>]')
  }
  return args
}

function toPosixHref(fromDir, toFile) {
  let rel = path.relative(fromDir, toFile)
  if (!rel.startsWith('.') && !rel.startsWith('..')) rel = './' + rel
  return rel.split(path.sep).join('/')
}

const { diagramDir, skillRoot } = parseArgs(process.argv.slice(2))
const assets = path.join(skillRoot, 'assets')
const iife = path.join(assets, 'aitopo.iife.js')
const host = path.join(assets, 'host', 'host.js')
const exportDiagram = path.join(assets, 'host', 'export-diagram.js')

for (const p of [iife, host, exportDiagram]) {
  if (!fs.existsSync(p)) throw new Error('missing runtime file: ' + p)
}

const out = {
  skillRoot,
  assets: toPosixHref(diagramDir, assets),
  iife: toPosixHref(diagramDir, iife),
  host: toPosixHref(diagramDir, host),
  exportDiagram: toPosixHref(diagramDir, exportDiagram),
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n')

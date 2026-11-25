#!/usr/bin/env node
/**
 * Split diagram.graph.json → root.graph.json + networks/,
 * regenerate INDEX.md. Does not rewrite diagram.html (run assemble after).
 *
 * Usage: node split-fragments.mjs <diagram-dir>
 *
 * Path layout (inverse of assemble-fragments.mjs):
 *   root children → networks/<id>.graph.json
 *   deeper        → …/<parentStem>/<id>.graph.json
 */
import fs from 'node:fs'
import path from 'node:path'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function childFragmentWritePath(netDir, parentFile, networkId) {
  if (path.basename(parentFile) === 'root.graph.json') {
    return path.join(netDir, `${networkId}.graph.json`)
  }
  return path.join(parentFile.replace(/\.graph\.json$/, ''), `${networkId}.graph.json`)
}

function stripAssembledMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta
  const { assembledFrom: _a, assembledAt: _b, ...rest } = meta
  return rest
}

/** Fragment on disk has no nested `networks` — assemble rebuilds that map. */
function toFragmentDoc(doc) {
  const { networks: _n, ...rest } = doc
  const out = { ...rest }
  if (out.meta) out.meta = stripAssembledMeta(out.meta)
  return out
}

function splitFragment(topo, netDir, doc, networkId, filePath, depth, fragments) {
  writeJson(filePath, toFragmentDoc(doc))
  fragments.push({
    id: networkId,
    file: path.relative(topo, filePath),
    meta: (doc.meta && stripAssembledMeta(doc.meta)) || {},
    nodes: (doc.nodes || []).length,
    depth,
  })

  const networks = doc.networks || {}
  const written = new Set()

  for (const node of doc.nodes || []) {
    const childId = node.networkId
    if (!childId || written.has(childId)) continue
    written.add(childId)
    const childDoc = networks[childId]
    if (!childDoc) {
      throw new Error(
        `portal "${node.id}" networkId="${childId}" missing under networks (parent ${path.relative(topo, filePath)})`,
      )
    }
    const childPath = childFragmentWritePath(netDir, filePath, childId)
    splitFragment(topo, netDir, childDoc, childId, childPath, depth + 1, fragments)
  }

  for (const childId of Object.keys(networks)) {
    if (written.has(childId)) continue
    console.warn(
      `orphan networks["${childId}"] in ${path.relative(topo, filePath)} — no portal; writing anyway`,
    )
    written.add(childId)
    const childPath = childFragmentWritePath(netDir, filePath, childId)
    splitFragment(topo, netDir, networks[childId], childId, childPath, depth + 1, fragments)
  }
}

function writeIndex(topo, indexPath, rootMeta, rootNodeCount, fragments) {
  const title = rootMeta.title || path.basename(topo)
  const esc = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const lines = [
    `# ${title} · 图碎片索引`,
    '',
    '源真相在 `root.graph.json` 与 `networks/`；`diagram.graph.json` / HTML 内嵌为 assemble 生成物。',
    '',
    '**Agent 约定：** 只打开要改的碎片 + 本 INDEX；不要把整份 `diagram.graph.json` 或 `diagram.html` 喂进上下文。',
    '',
    `| depth | id | file | nodes | title | summary |`,
    `| --- | --- | --- | ---: | --- | --- |`,
    `| 0 | _(root)_ | \`root.graph.json\` | ${rootNodeCount} | ${esc(rootMeta.title)} | ${esc(rootMeta.summary)} |`,
  ]

  for (const f of [...fragments].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))) {
    lines.push(
      `| ${f.depth} | \`${f.id}\` | \`${f.file}\` | ${f.nodes} | ${esc(f.meta.title)} | ${esc(f.meta.summary)} |`,
    )
  }
  lines.push('', '## 常用命令', '', '```bash')
  lines.push('node <skill>/scripts/assemble-fragments.mjs .')
  lines.push('node <skill>/scripts/split-fragments.mjs .')
  lines.push('```', '')
  fs.writeFileSync(indexPath, `${lines.join('\n')}\n`, 'utf8')
}

function main() {
  const topo = path.resolve(process.argv[2] || '.')
  const inJson = path.join(topo, 'diagram.graph.json')
  const rootPath = path.join(topo, 'root.graph.json')
  const netDir = path.join(topo, 'networks')
  const outIndex = path.join(topo, 'INDEX.md')

  if (!fs.existsSync(inJson)) {
    console.error(`missing ${inJson}`)
    process.exit(1)
  }

  const doc = readJson(inJson)
  const fragments = []
  splitFragment(topo, netDir, doc, 'root', rootPath, 0, fragments)
  const netFragments = fragments.filter((f) => f.id !== 'root')
  const rootMeta = stripAssembledMeta(doc.meta || {}) || {}

  writeIndex(topo, outIndex, rootMeta, (doc.nodes || []).length, netFragments)

  console.log(`split ${inJson} → ${rootPath} + ${netDir}/ (${netFragments.length} networks)`)
  console.log(`wrote ${outIndex}`)
}

main()

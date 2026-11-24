#!/usr/bin/env node
/**
 * Assemble root.graph.json + networks/ → diagram.graph.json,
 * sync #diagram-data in diagram.html, regenerate INDEX.md.
 *
 * Usage: node assemble-fragments.mjs <diagram-dir>
 */
import fs from 'node:fs'
import path from 'node:path'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function childFragmentPath(topo, netDir, parentFile, networkId) {
  if (path.basename(parentFile) === 'root.graph.json') {
    return path.join(netDir, `${networkId}.graph.json`)
  }
  // Prefer nested: …/parentStem/childId.graph.json; fall back to sibling: …/childId.graph.json
  const nested = path.join(parentFile.replace(/\.graph\.json$/, ''), `${networkId}.graph.json`)
  const sibling = path.join(path.dirname(parentFile), `${networkId}.graph.json`)
  if (fs.existsSync(nested)) return nested
  if (fs.existsSync(sibling)) return sibling
  return nested
}

function assembleFragment(topo, netDir, filePath, networkId, depth) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing fragment for "${networkId}": ${filePath}`)
  }
  const base = readJson(filePath)
  const networks = {}
  const fragments = [
    {
      id: networkId,
      file: path.relative(topo, filePath),
      meta: base.meta || {},
      nodes: (base.nodes || []).length,
      depth,
    },
  ]

  for (const node of base.nodes || []) {
    const childId = node.networkId
    if (!childId || networks[childId]) continue
    const childPath = childFragmentPath(topo, netDir, filePath, childId)
    const child = assembleFragment(topo, netDir, childPath, childId, depth + 1)
    networks[childId] = child.doc
    fragments.push(...child.fragments)
  }

  const doc = { ...base }
  if (Object.keys(networks).length > 0) doc.networks = networks
  else delete doc.networks
  return { doc, fragments }
}

function syncHtml(htmlPath, doc) {
  if (!fs.existsSync(htmlPath)) {
    console.warn(`skip HTML sync — missing ${htmlPath}`)
    return
  }
  let html = fs.readFileSync(htmlPath, 'utf8')
  const re = /(<script type="application\/json" id="diagram-data">)([\s\S]*?)(<\/script>)/
  if (!re.test(html)) {
    throw new Error(`#diagram-data not found in ${htmlPath}`)
  }
  html = html.replace(re, `$1\n${JSON.stringify(doc, null, 2)}\n  $3`)
  fs.writeFileSync(htmlPath, html, 'utf8')
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
  const rootPath = path.join(topo, 'root.graph.json')
  const netDir = path.join(topo, 'networks')
  const outJson = path.join(topo, 'diagram.graph.json')
  const outHtml = path.join(topo, 'diagram.html')
  const outIndex = path.join(topo, 'INDEX.md')

  if (!fs.existsSync(rootPath)) {
    console.error(`missing ${rootPath} — run split-fragments.mjs first`)
    process.exit(1)
  }

  const { doc, fragments } = assembleFragment(topo, netDir, rootPath, 'root', 0)
  const netFragments = fragments.filter((f) => f.id !== 'root')

  if (!doc.meta) doc.meta = {}
  doc.meta.assembledFrom = 'root.graph.json + networks/'
  doc.meta.assembledAt = new Date().toISOString().slice(0, 10)

  writeJson(outJson, doc)
  syncHtml(outHtml, doc)
  writeIndex(topo, outIndex, doc.meta, (doc.nodes || []).length, netFragments)

  console.log(`assembled ${outJson} (${fs.statSync(outJson).size} bytes)`)
  console.log(`synced ${outHtml}`)
  console.log(`wrote ${outIndex} (${netFragments.length} networks)`)
}

main()

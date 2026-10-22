import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import vm from 'node:vm'

const exportSrc = readFileSync(
  '.agents/skills/topo-diagram/assets/host/export-diagram.js',
  'utf8',
)

function loadExport(): {
  toSvg: (doc: unknown) => string
  toExcalidraw: (doc: unknown) => { elements: unknown[] }
  toDrawio: (doc: unknown) => string
} {
  const sandbox: { TopoDiagramExport?: ReturnType<typeof loadExport>; console: Console } = {
    console,
  }
  vm.runInNewContext(exportSrc + '\nthis.TopoDiagramExport = TopoDiagramExport', sandbox)
  if (!sandbox.TopoDiagramExport) throw new Error('TopoDiagramExport missing')
  return sandbox.TopoDiagramExport as ReturnType<typeof loadExport>
}

const sample = {
  version: 1,
  meta: { title: 'Export sample' },
  nodes: [
    { id: 'a', type: 'component', label: 'A', x: 0, y: 0, w: 80, h: 40, data: { fill: '#fff', stroke: '#2d3142' } },
    { id: 'b', type: 'component', label: 'B', x: 200, y: 0, w: 80, h: 40, data: { fill: '#fff', stroke: '#2d3142' } },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b', label: 'flow', style: { stroke: '#4f5d75' } },
  ],
}

describe('topo-diagram host export converters', () => {
  it('builds SVG with nodes and an edge path', () => {
    const { toSvg } = loadExport()
    const svg = toSvg(sample)
    expect(svg).toContain('<svg')
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>B</text>')
    expect(svg).toContain('<path d=')
    expect(svg).toContain('flow')
  })

  it('builds Excalidraw elements for nodes and an arrow', () => {
    const { toExcalidraw } = loadExport()
    const file = toExcalidraw(sample)
    expect(file.type).toBe('excalidraw')
    const types = file.elements.map((el: { type: string }) => el.type)
    expect(types).toContain('rectangle')
    expect(types).toContain('arrow')
    expect(types).toContain('text')
  })

  it('builds draw.io mxfile with vertices and an edge', () => {
    const { toDrawio } = loadExport()
    const xml = toDrawio(sample)
    expect(xml).toContain('<mxfile')
    expect(xml).toContain('vertex="1"')
    expect(xml).toContain('edge="1"')
    expect(xml).toContain('source="a"')
    expect(xml).toContain('target="b"')
  })
})

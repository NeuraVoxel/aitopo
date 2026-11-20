/**
 * Golden topo-diagram flowchart / pipeline GraphDocuments stay protocol-valid.
 */

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDocument } from '../src/protocol/parse.ts'

const examplesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.agents/skills/topo-diagram/assets/examples',
)

describe('topo-diagram layout examples', () => {
  const files = readdirSync(examplesDir).filter(name => name.endsWith('.json'))

  it('ships at least the catalogued flowchart goldens', () => {
    expect(files.length).toBeGreaterThanOrEqual(7)
  })

  for (const file of files) {
    it(`parses ${file}`, () => {
      const raw = JSON.parse(readFileSync(path.join(examplesDir, file), 'utf8')) as unknown
      const doc = parseDocument(raw)
      expect(doc.version).toBe(1)
      expect(doc.nodes.length).toBeGreaterThan(0)
      expect(doc.nodes.length).toBeLessThanOrEqual(9)
      expect(doc.edges.length).toBeLessThanOrEqual(12)
      for (const node of doc.nodes) {
        expect(node.x! % 4).toBe(0)
        expect(node.y! % 4).toBe(0)
        expect(node.data?.fill).toBeTruthy()
        expect(node.data?.stroke).toBeTruthy()
      }
    })
  }
})

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ADAS_THEME_OPTIONS,
  getAdasTheme,
  isAdasThemeId,
  listAdasThemeHexes,
  setAdasTheme,
} from '../demo/lib/adas-theme.ts'
import { listFoxglovePaletteHexes } from '../demo/lib/foxglove-palette.ts'
import { listNuplanPaletteHexes } from '../demo/lib/nuplan-palette.ts'
import { listRvizPaletteHexes } from '../demo/lib/rviz-palette.ts'
import { getSample, listSamples } from '../demo/samples/registry.ts'

const ADAS_DIR = join(process.cwd(), 'demo/samples/adas')
const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g

describe('ADAS samples use theme palettes only', () => {
  afterEach(() => {
    setAdasTheme('nuboard')
  })

  it('lists nuBoard, Foxglove, and RViz palette hex tokens', () => {
    const nuboard = listNuplanPaletteHexes()
    const fox = listFoxglovePaletteHexes()
    const rviz = listRvizPaletteHexes()
    expect(nuboard.has('#ffffff')).toBe(true)
    expect(nuboard.has('#00c8c8')).toBe(true)
    expect(fox.has('#a56eff')).toBe(true)
    expect(fox.has('#121619')).toBe(true)
    expect(rviz.has('#303030')).toBe(true)
    expect(rviz.has('#a0a0a4')).toBe(true)
    const merged = listAdasThemeHexes()
    expect(merged.size).toBeGreaterThan(nuboard.size)
    expect(merged.has('#a56eff')).toBe(true)
    expect(merged.has('#303030')).toBe(true)
  })

  it('defaults to nuboard and switches across registered themes', () => {
    expect(getAdasTheme()).toBe('nuboard')
    setAdasTheme('foxglove')
    expect(getAdasTheme()).toBe('foxglove')
    setAdasTheme('rviz')
    expect(getAdasTheme()).toBe('rviz')
  })

  it('exposes a dropdown catalog of registered theme ids', () => {
    expect(ADAS_THEME_OPTIONS.map(option => option.id)).toEqual(['nuboard', 'foxglove', 'rviz'])
    expect(isAdasThemeId('rviz')).toBe(true)
    expect(isAdasThemeId('carla')).toBe(false)
  })

  it('forbids ad-hoc hex chrome under demo/samples/adas/', () => {
    const allowed = listAdasThemeHexes()
    const files = readdirSync(ADAS_DIR).filter(name => name.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(5)

    const offenders: string[] = []
    for (const name of files) {
      const text = readFileSync(join(ADAS_DIR, name), 'utf8')
      for (const match of text.matchAll(HEX_RE)) {
        const hex = match[0]!.toLowerCase()
        if (allowed.has(hex)) continue
        offenders.push(`${name}: ${match[0]}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('rebuilds ADAS documents when theme switches', () => {
    const sample = getSample('adas-agent')
    expect(sample).toBeDefined()
    setAdasTheme('nuboard')
    const nuboardStroke = sample!.document.nodes.find(n => n.id === 'ego')?.data?.stroke
    setAdasTheme('foxglove')
    const foxStroke = sample!.document.nodes.find(n => n.id === 'ego')?.data?.stroke
    setAdasTheme('rviz')
    const rvizStroke = sample!.document.nodes.find(n => n.id === 'ego')?.data?.stroke
    expect(nuboardStroke).toBe('#808080')
    expect(foxStroke).toBe('#a56eff')
    expect(rvizStroke).toBe('#a0a0a4')
  })

  it('keeps every ADAS loadable sample document parseable under all themes', () => {
    const samples = listSamples().filter(s => s.group === 'adas' && s.reserved !== true)
    expect(samples.length).toBe(7)
    for (const theme of ADAS_THEME_OPTIONS.map(option => option.id)) {
      setAdasTheme(theme)
      for (const sample of samples) {
        expect(sample.document.nodes.length, `${theme}:${sample.id}`).toBeGreaterThan(0)
      }
    }
  })
})

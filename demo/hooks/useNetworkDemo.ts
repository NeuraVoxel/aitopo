import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  Network,
  PatchHistory,
  parseDocument,
  type GraphDocument,
  type GraphPatch,
} from '../../src/index.ts'
import { DEFAULT_SAMPLE_ID, getSample } from '../samples/registry.ts'
import { buildInteractions, type DemoMode } from '../lib/interactions.ts'
import {
  resetDemoOnSubNetworkChanged,
  runDemoHistoryStep,
} from '../lib/subnetwork-session.ts'
import { ADAS_AGENT, getAdasTheme, setAdasTheme, type AdasThemeId } from '../lib/adas-theme.ts'
import { whenDemoEgoBitmapReady } from '../lib/vector-images.ts'

export type { DemoMode, AdasThemeId }

export interface NetworkDemoApi {
  stageRef: RefObject<HTMLDivElement | null>
  sampleId: string
  mode: DemoMode
  debug: boolean
  /** Neighbor flood for partial dirty paints (Network default on; Perf sample opts out). */
  expandPartialDirty: boolean
  status: string
  selectedIds: readonly string[]
  canUndo: boolean
  canRedo: boolean
  /** Active ADAS chrome theme (nuBoard default). */
  adasTheme: AdasThemeId
  /** True when the loaded sample is in the ADAS group (theme toggle visible). */
  adasThemeControls: boolean
  setSampleId: (id: string) => void
  setMode: (mode: DemoMode) => void
  setDebug: (value: boolean) => void
  setExpandPartialDirty: (value: boolean) => void
  setAdasThemeId: (id: AdasThemeId) => void
  undo: () => void
  redo: () => void
  applyPatch: (patch: GraphPatch) => void
  /** Replaces the current network's document in place (live samples); no remount. */
  loadDocument: (doc: GraphDocument) => void
  fitContent: () => void
  /** Latest Network instance for property reads (null before mount). */
  getNetwork: () => Network | null
}

const CREATE_NODE_W = 80
const CREATE_NODE_H = 48
const CREATE_CLICK_DRAG_PX = 4

function fitNetwork(network: Network): void {
  network.fitContent(32)
}

function wrapApplyWithHistory(
  network: Network,
  history: PatchHistory,
  onRecorded: () => void,
): void {
  network.apply = (patch: GraphPatch | unknown) => {
    history.pushAndApply(patch as GraphPatch)
    onRecorded()
  }
}

const MODE_STATUS: Record<DemoMode, string> = {
  observe: 'Observe',
  edit: 'Edit — move / resize / bend / path·shape vertex; Alt+drag link; Delete removes',
  'create-node': 'Create Node — click empty canvas',
  'create-link': 'Create Link — drag node to node',
  'create-path': 'Create Path — click points; Enter or double-click to commit; Esc cancels',
  'create-shape-node':
    'Create ShapeNode — click points; Enter or double-click to commit; Esc cancels',
}

/**
 * Mounts one Network into `stageRef`. Sample or mode change destroys and remounts
 * (history cleared). `subNetworkChanged` clears history and selection. Reserved
 * samples set status only and leave the current Network. Status shows sample
 * title plus the active mode label.
 */
export function useNetworkDemo(): NetworkDemoApi {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const networkRef = useRef<Network | null>(null)
  const historyRef = useRef<PatchHistory | null>(null)
  const undoDepthRef = useRef(0)
  const redoDepthRef = useRef(0)
  const debugRef = useRef(false)
  const expandPartialDirtyRef = useRef(true)

  const [sampleId, setSampleIdState] = useState(DEFAULT_SAMPLE_ID)
  const [mode, setMode] = useState<DemoMode>('observe')
  const [debug, setDebugState] = useState(false)
  const [expandPartialDirty, setExpandPartialDirtyState] = useState(true)
  const [adasTheme, setAdasThemeState] = useState<AdasThemeId>(() => getAdasTheme())
  const [status, setStatus] = useState('')
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  debugRef.current = debug
  expandPartialDirtyRef.current = expandPartialDirty

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(undoDepthRef.current > 0)
    setCanRedo(redoDepthRef.current > 0)
  }, [])

  const clearHistoryFlags = useCallback(() => {
    undoDepthRef.current = 0
    redoDepthRef.current = 0
    setCanUndo(false)
    setCanRedo(false)
  }, [])

  useEffect(() => {
    const host = stageRef.current
    if (host === null) return

    const sample = getSample(sampleId)
    if (sample === undefined) {
      setStatus(`Unknown sample: ${sampleId}`)
      return
    }
    if (sample.reserved === true) {
      setStatus(`Reserved: ${sample.title}`)
      return
    }

    // Sample opt-out (Perf) or engine default on; keeps property-panel checkbox in sync.
    const expandDirty = sample.expandPartialDirty ?? true
    if (expandPartialDirtyRef.current !== expandDirty) {
      expandPartialDirtyRef.current = expandDirty
      setExpandPartialDirtyState(expandDirty)
    }

    const network = new Network({
      debugPaintRects: debugRef.current,
      expandPartialDirty: expandDirty,
      interactions: buildInteractions(mode),
    })
    network.mount(host)

    const rawApply = network.apply.bind(network)
    if (mode !== 'observe') {
      const history = new PatchHistory(rawApply, () => network.toJSON())
      historyRef.current = history
      wrapApplyWithHistory(network, history, () => {
        undoDepthRef.current += 1
        redoDepthRef.current = 0
        syncHistoryFlags()
      })
    } else {
      historyRef.current = null
    }

    const unsub = network.on(event => {
      if (event.type === 'selectionChanged' || event.type === 'documentChanged') {
        setSelectedIds(previous => {
          const next = [...network.getSelectedIds()]
          if (
            previous.length === next.length
            && previous.every((id, index) => id === next[index])
          ) {
            return previous
          }
          return next
        })
      }
      if (event.type === 'nodeActivated' && event.detail === 'dblclick') {
        // Generic drill-in: any node carrying a networkId enters its child
        // document (samples like DSH boot key phases to sub-networks).
        const target = network.getNode(event.nodeId)
        if (target?.networkId !== undefined) network.enterSubNetwork(target.networkId)
      }
      if (event.type === 'subNetworkChanged') {
        const selected = resetDemoOnSubNetworkChanged({
          history: historyRef.current,
          getSelectedIds: () => network.getSelectedIds(),
          setSelection: nextIds => network.setSelection(nextIds),
        })
        setSelectedIds([...selected])
        clearHistoryFlags()
      }
    })

    // Escape is the matching generic exit for the dblclick drill-in above.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (network.currentNetworkId !== null) network.exitSubNetwork()
    }
    window.addEventListener('keydown', onKeyDown)

    network.load(parseDocument(sample.document))
    if (sample.defaultLayout !== undefined) {
      network.layout(sample.defaultLayout)
    }
    networkRef.current = network
    clearHistoryFlags()
    setSelectedIds([...network.getSelectedIds()])
    setStatus(`${sample.title} · ${MODE_STATUS[mode]}`)
    fitNetwork(network)

    let fittedOnSize = false
    const resize = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect === undefined || fittedOnSize) return
      if (rect.width <= 0 || rect.height <= 0) return
      fittedOnSize = true
      fitNetwork(network)
    })
    resize.observe(host)
    const frame = requestAnimationFrame(() => {
      fitNetwork(network)
    })

    // ADAS Ego: pulse vectorImagePhase only on style #4 (ego-animate);
    // redraw bitmap ego once the PNG is decoded.
    let pulseTimer: ReturnType<typeof setInterval> | undefined
    let cancelled = false
    if (sample.id === 'adas-ego') {
      const started = performance.now()
      pulseTimer = setInterval(() => {
        const phase = ((performance.now() - started) / 2000) % 1
        rawApply({
          ops: [{
            op: 'updateNode',
            id: 'ego-animate',
            patch: {
              data: {
                fill: ADAS_AGENT.ego.fill,
                stroke: ADAS_AGENT.ego.stroke,
                role: 'ego',
                axle: 'rear',
                speedMs: 12.5,
                vectorImagePhase: phase,
              },
            },
          }],
        })
      }, 50)
      void whenDemoEgoBitmapReady().then(() => {
        if (cancelled) return
        rawApply({
          ops: [{
            op: 'updateNode',
            id: 'ego-bitmap',
            patch: {
              data: {
                fill: 'rgba(0,0,0,0)',
                stroke: ADAS_AGENT.ego.stroke,
                role: 'ego',
              },
            },
          }],
        })
      })
    }

    return () => {
      cancelled = true
      if (pulseTimer !== undefined) clearInterval(pulseTimer)
      cancelAnimationFrame(frame)
      resize.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      unsub()
      network.destroy()
      networkRef.current = null
      historyRef.current = null
    }
  }, [sampleId, mode, adasTheme, syncHistoryFlags, clearHistoryFlags])

  useEffect(() => {
    networkRef.current?.setDebugPaintRects(debug)
  }, [debug])

  useEffect(() => {
    networkRef.current?.setExpandPartialDirty(expandPartialDirty)
  }, [expandPartialDirty])

  // Stage bubble pointerup runs after SelectActivate on the canvas.
  useEffect(() => {
    if (mode !== 'create-node') return
    const host = stageRef.current
    if (host === null) return

    let downX = 0
    let downY = 0

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      downX = event.clientX
      downY = event.clientY
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (event.button !== 0) return
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > CREATE_CLICK_DRAG_PX) {
        return
      }
      const clientX = event.clientX
      const clientY = event.clientY
      queueMicrotask(() => {
        const network = networkRef.current
        if (network === null) return
        if (network.getSelectedIds().length > 0) return
        const canvas = network.getHitElement()
        if (canvas === null) return
        const rect = canvas.getBoundingClientRect()
        const screenX = clientX - rect.left
        const screenY = clientY - rect.top
        if (screenX < 0 || screenY < 0 || screenX > rect.width || screenY > rect.height) return
        if (network.hitTestScreen(screenX, screenY) !== undefined) return
        const world = network.screenToWorld(screenX, screenY)
        network.apply({
          ops: [{
            op: 'addNode',
            node: {
              id: `n-${Date.now()}`,
              type: 'unit',
              label: 'node',
              x: world.x,
              y: world.y,
              w: CREATE_NODE_W,
              h: CREATE_NODE_H,
            },
          }],
        })
      })
    }

    host.addEventListener('pointerdown', onPointerDown)
    host.addEventListener('pointerup', onPointerUp)
    return () => {
      host.removeEventListener('pointerdown', onPointerDown)
      host.removeEventListener('pointerup', onPointerUp)
    }
  }, [mode])

  const setSampleId = useCallback((id: string) => {
    const sample = getSample(id)
    if (sample === undefined) {
      setStatus(`Unknown sample: ${id}`)
      return
    }
    if (sample.reserved === true) {
      setStatus(`Reserved: ${sample.title}`)
      return
    }
    setSampleIdState(id)
  }, [])

  const setDebug = useCallback((value: boolean) => {
    setDebugState(value)
  }, [])

  const setExpandPartialDirty = useCallback((value: boolean) => {
    setExpandPartialDirtyState(value)
  }, [])

  const setAdasThemeId = useCallback((id: AdasThemeId) => {
    setAdasTheme(id)
    setAdasThemeState(id)
  }, [])

  const undo = useCallback(() => {
    const history = historyRef.current
    if (history === null) return
    const error = runDemoHistoryStep(
      () => history.undo(),
      () => {
        undoDepthRef.current -= 1
        redoDepthRef.current += 1
        syncHistoryFlags()
      },
    )
    if (error !== undefined) setStatus(error)
  }, [syncHistoryFlags])

  const redo = useCallback(() => {
    const history = historyRef.current
    if (history === null) return
    const error = runDemoHistoryStep(
      () => history.redo(),
      () => {
        undoDepthRef.current += 1
        redoDepthRef.current -= 1
        syncHistoryFlags()
      },
    )
    if (error !== undefined) setStatus(error)
  }, [syncHistoryFlags])

  const applyPatch = useCallback((patch: GraphPatch) => {
    networkRef.current?.apply(patch)
  }, [])

  const loadDocument = useCallback((doc: GraphDocument) => {
    const network = networkRef.current
    if (network === null) return
    network.load(parseDocument(doc))
    setSelectedIds([...network.getSelectedIds()])
    fitNetwork(network)
  }, [])

  const fitContent = useCallback(() => {
    const network = networkRef.current
    if (network === null) return
    fitNetwork(network)
  }, [])

  const getNetwork = useCallback(() => networkRef.current, [])

  const adasThemeControls = getSample(sampleId)?.group === 'adas'

  return {
    stageRef,
    sampleId,
    mode,
    debug,
    expandPartialDirty,
    status,
    selectedIds,
    canUndo,
    canRedo,
    adasTheme,
    adasThemeControls,
    setSampleId,
    setMode,
    setDebug,
    setExpandPartialDirty,
    setAdasThemeId,
    undo,
    redo,
    applyPatch,
    loadDocument,
    fitContent,
    getNetwork,
  }
}

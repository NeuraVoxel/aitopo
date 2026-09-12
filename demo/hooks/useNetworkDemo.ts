import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  Network,
  PatchHistory,
  contentBounds,
  parseDocument,
  type GraphPatch,
} from '../../src/index.ts'
import { DEFAULT_SAMPLE_ID, getSample } from '../samples/registry.ts'
import { buildInteractions, type DemoMode } from '../lib/interactions.ts'
import {
  resetDemoOnSubNetworkChanged,
  runDemoHistoryStep,
} from '../lib/subnetwork-session.ts'

export type { DemoMode }

export interface NetworkDemoApi {
  stageRef: RefObject<HTMLDivElement | null>
  sampleId: string
  mode: DemoMode
  debug: boolean
  status: string
  selectedIds: readonly string[]
  canUndo: boolean
  canRedo: boolean
  setSampleId: (id: string) => void
  setMode: (mode: DemoMode) => void
  setDebug: (value: boolean) => void
  undo: () => void
  redo: () => void
  applyPatch: (patch: GraphPatch) => void
  fitContent: () => void
  /** Latest Network instance for property reads (null before mount). */
  getNetwork: () => Network | null
}

const CREATE_NODE_W = 80
const CREATE_NODE_H = 48
const CREATE_CLICK_DRAG_PX = 4

function fitNetwork(network: Network): void {
  const bounds = contentBounds(network.scene)
  if (bounds !== undefined) {
    network.updateCamera(viewport => {
      viewport.fitBounds(bounds, 32)
    })
  }
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

/**
 * Mounts one Network into `stageRef`. Sample or mode change destroys and remounts
 * (history cleared). `subNetworkChanged` clears history and selection. Reserved
 * samples set status only and leave the current Network.
 */
export function useNetworkDemo(): NetworkDemoApi {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const networkRef = useRef<Network | null>(null)
  const historyRef = useRef<PatchHistory | null>(null)
  const undoDepthRef = useRef(0)
  const redoDepthRef = useRef(0)
  const debugRef = useRef(false)

  const [sampleId, setSampleIdState] = useState(DEFAULT_SAMPLE_ID)
  const [mode, setMode] = useState<DemoMode>('observe')
  const [debug, setDebugState] = useState(false)
  const [status, setStatus] = useState('')
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  debugRef.current = debug

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

    const network = new Network({
      debugPaintRects: debugRef.current,
      interactions: buildInteractions(mode),
    })
    network.mount(host)

    if (mode !== 'observe') {
      const rawApply = network.apply.bind(network)
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
        setSelectedIds([...network.getSelectedIds()])
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

    network.load(parseDocument(sample.document))
    if (sample.defaultLayout !== undefined) {
      network.layout(sample.defaultLayout)
    }
    networkRef.current = network
    clearHistoryFlags()
    setSelectedIds([...network.getSelectedIds()])
    setStatus(sample.title)
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

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      unsub()
      network.destroy()
      networkRef.current = null
      historyRef.current = null
    }
  }, [sampleId, mode, syncHistoryFlags, clearHistoryFlags])

  useEffect(() => {
    networkRef.current?.setDebugPaintRects(debug)
  }, [debug])

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

  const fitContent = useCallback(() => {
    const network = networkRef.current
    if (network === null) return
    fitNetwork(network)
  }, [])

  const getNetwork = useCallback(() => networkRef.current, [])

  return {
    stageRef,
    sampleId,
    mode,
    debug,
    status,
    selectedIds,
    canUndo,
    canRedo,
    setSampleId,
    setMode,
    setDebug,
    undo,
    redo,
    applyPatch,
    fitContent,
    getNetwork,
  }
}

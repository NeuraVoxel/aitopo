import { CanvasHost } from './components/CanvasHost.tsx'
import { PropertyPanel } from './components/PropertyPanel.tsx'
import { SampleNav } from './components/SampleNav.tsx'
import { StatusBar } from './components/StatusBar.tsx'
import { Toolbar } from './components/Toolbar.tsx'
import { useNetworkDemo } from './hooks/useNetworkDemo.ts'
import { listSamples } from './samples/registry.ts'

export function App() {
  const demo = useNetworkDemo()
  return (
    <div className="app">
      <Toolbar
        mode={demo.mode}
        debug={demo.debug}
        canUndo={demo.canUndo}
        canRedo={demo.canRedo}
        setMode={demo.setMode}
        setDebug={demo.setDebug}
        undo={demo.undo}
        redo={demo.redo}
      />
      <div className="app-body">
        <SampleNav
          samples={listSamples()}
          activeId={demo.sampleId}
          onSelect={demo.setSampleId}
        />
        <CanvasHost stageRef={demo.stageRef} />
        <PropertyPanel
          selectedIds={demo.selectedIds}
          applyPatch={demo.applyPatch}
          getNetwork={demo.getNetwork}
        />
      </div>
      <StatusBar status={demo.status} />
    </div>
  )
}

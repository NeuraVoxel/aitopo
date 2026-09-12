import { CanvasHost } from './components/CanvasHost.tsx'
import { SampleNav } from './components/SampleNav.tsx'
import { useNetworkDemo } from './hooks/useNetworkDemo.ts'
import { listSamples } from './samples/registry.ts'

export function App() {
  const demo = useNetworkDemo()
  return (
    <div className="app">
      <SampleNav
        samples={listSamples()}
        activeId={demo.sampleId}
        onSelect={demo.setSampleId}
      />
      <CanvasHost stageRef={demo.stageRef} />
    </div>
  )
}

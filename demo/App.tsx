import { CanvasHost } from './components/CanvasHost.tsx'
import { useNetworkDemo } from './hooks/useNetworkDemo.ts'

export function App() {
  const demo = useNetworkDemo()
  return (
    <div className="app">
      <CanvasHost stageRef={demo.stageRef} />
    </div>
  )
}

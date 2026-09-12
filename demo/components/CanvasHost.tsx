import type { RefObject } from 'react'

export interface CanvasHostProps {
  readonly stageRef: RefObject<HTMLDivElement | null>
}

/** Stage element for `Network.mount`. */
export function CanvasHost({ stageRef }: CanvasHostProps) {
  return <div className="canvas-host" ref={stageRef} />
}

import {
  CreateEdgeInteraction,
  CreatePathInteraction,
  DeleteEdgeInteraction,
  ExternalDropInteraction,
  MoveEdgeBendInteraction,
  MovePathVertexInteraction,
  ResizeNodeInteraction,
  type Interaction,
} from '../../src/index.ts'

export type DemoMode = 'observe' | 'edit' | 'create-node' | 'create-link' | 'create-path'

/**
 * Extra interactions appended to Network defaults
 * (`PanZoom` + `SelectActivate` + `MoveNode` + `MarqueeSelect`).
 * Move and marquee are defaults now, so modes no longer list them.
 * `MovePathVertexInteraction` uses pointer capture-phase so handle hits win
 * over default `MoveNode` body drag even though extras attach after defaults.
 * @param mode - mutually exclusive demo interaction mode.
 */
export function buildInteractions(mode: DemoMode): readonly Interaction[] {
  switch (mode) {
    case 'observe':
      return []
    case 'edit':
      return [
        new MovePathVertexInteraction(),
        new MoveEdgeBendInteraction(),
        new ResizeNodeInteraction(),
        new DeleteEdgeInteraction(),
        new CreateEdgeInteraction({ requireAlt: true }),
        new ExternalDropInteraction(),
      ]
    case 'create-link':
      return [
        new DeleteEdgeInteraction(),
        new CreateEdgeInteraction({ requireAlt: false }),
      ]
    case 'create-path':
      return [
        new DeleteEdgeInteraction(),
        new CreatePathInteraction(),
      ]
    case 'create-node':
      return [new ExternalDropInteraction()]
    default: {
      const _e: never = mode
      throw new Error(String(_e))
    }
  }
}

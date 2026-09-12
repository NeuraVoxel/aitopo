import {
  CreateEdgeInteraction,
  DeleteEdgeInteraction,
  ExternalDropInteraction,
  MoveEdgeBendInteraction,
  ResizeNodeInteraction,
  type Interaction,
} from '../../src/index.ts'

export type DemoMode = 'observe' | 'edit' | 'create-node' | 'create-link'

/**
 * Extra interactions appended to Network defaults
 * (`PanZoom` + `SelectActivate` + `MoveNode` + `MarqueeSelect`).
 * Move and marquee are defaults now, so modes no longer list them.
 * @param mode - mutually exclusive demo interaction mode.
 */
export function buildInteractions(mode: DemoMode): readonly Interaction[] {
  switch (mode) {
    case 'observe':
      return []
    case 'edit':
      return [
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
    case 'create-node':
      return [new ExternalDropInteraction()]
    default: {
      const _e: never = mode
      throw new Error(String(_e))
    }
  }
}

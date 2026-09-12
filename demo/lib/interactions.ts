import {
  CreateEdgeInteraction,
  DeleteEdgeInteraction,
  ExternalDropInteraction,
  MarqueeSelectInteraction,
  MoveEdgeBendInteraction,
  MoveNodeInteraction,
  ResizeNodeInteraction,
  type Interaction,
} from '../../src/index.ts'

export type DemoMode = 'observe' | 'edit' | 'create-node' | 'create-link'

/**
 * Extra interactions appended to Network defaults (`PanZoom` + `SelectActivate`).
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
        new MoveNodeInteraction(),
        new DeleteEdgeInteraction(),
        new CreateEdgeInteraction({ requireAlt: true }),
        new MarqueeSelectInteraction(),
        new ExternalDropInteraction(),
      ]
    case 'create-link':
      return [
        new DeleteEdgeInteraction(),
        new CreateEdgeInteraction({ requireAlt: false }),
        new MarqueeSelectInteraction(),
      ]
    case 'create-node':
      return [new ExternalDropInteraction(), new MarqueeSelectInteraction()]
    default: {
      const _e: never = mode
      throw new Error(String(_e))
    }
  }
}

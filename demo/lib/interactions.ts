import {
  CreateEdgeInteraction,
  CreatePathInteraction,
  CreateShapeNodeInteraction,
  DeleteEdgeInteraction,
  ExternalDropInteraction,
  MoveEdgeBendInteraction,
  MovePathVertexInteraction,
  MoveShapeNodeVertexInteraction,
  ResizeNodeInteraction,
  type Interaction,
} from '../../src/index.ts'

export type DemoMode =
  | 'observe'
  | 'edit'
  | 'create-node'
  | 'create-link'
  | 'create-path'
  | 'create-shape-node'

/**
 * Extra interactions appended to Network defaults
 * (`PanZoom` + `SelectActivate` + `MoveNode` + `MarqueeSelect`).
 * Move and marquee are defaults now, so modes no longer list them.
 * Path / ShapeNode vertex interactions use pointer capture-phase so handle hits
 * win over default `MoveNode` body drag even though extras attach after defaults.
 * @param mode - mutually exclusive demo interaction mode.
 */
export function buildInteractions(mode: DemoMode): readonly Interaction[] {
  switch (mode) {
    case 'observe':
      return []
    case 'edit':
      return [
        new MovePathVertexInteraction(),
        new MoveShapeNodeVertexInteraction(),
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
    case 'create-shape-node':
      return [
        new DeleteEdgeInteraction(),
        new CreateShapeNodeInteraction(),
      ]
    case 'create-node':
      return [new ExternalDropInteraction()]
    default: {
      const _e: never = mode
      throw new Error(String(_e))
    }
  }
}

/**
 * AITopo protocol types — Document / Patch / Alarm vocabulary shared by hosts and models.
 */

/** Alarm severity shown on nodes or edges. */
export type AlarmLevel = 'info' | 'warn' | 'error'

/** One alarm attached to a graph element. */
export interface Alarm {
  readonly id: string
  readonly level: AlarmLevel
  readonly message: string
  readonly ts?: string
}

/** Optional document metadata. */
export interface GraphMeta {
  readonly title?: string
  readonly kind?: 'topology' | 'flow' | 'custom'
  readonly [key: string]: unknown
}

/** Viewport camera snapshot when persisted in the document. */
export interface GraphViewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

/** Fixed attachment anchor relative to the node body (free offsets later). */
export type AttachmentPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'center'

/** Text paint overrides for label / label2 / tooltip attachments. */
export interface GraphTextStyle {
  readonly color?: string
  readonly fontSize?: number
}

/** Selection or hover chrome around the node body. */
export interface GraphChromeStyle {
  readonly color?: string
  readonly width?: number
  readonly padding?: number
}

/** Canvas shadow used once on the node body. */
export interface GraphShadowStyle {
  readonly color?: string
  readonly blur?: number
  readonly offsetX?: number
  readonly offsetY?: number
}

/** Optional per-node visual overrides (one-level merge on updateNode). */
export interface GraphNodeStyle {
  readonly labelPosition?: AttachmentPosition
  readonly label2Position?: AttachmentPosition
  readonly tooltipPosition?: AttachmentPosition
  /** Default `hover` — overlay only; `always` joins scene + union bounds. */
  readonly tooltipMode?: 'hover' | 'always'
  /**
   * Whole-node opacity in `[0, 1]` (twaver `whole.alpha`). Default `1`.
   * Applies to body, scene attachments, and overlay chrome/tooltip for this node.
   */
  readonly alpha?: number
  /**
   * Whether to paint IconsAttachment. Default `true` when omitted
   * (Network may supply a host default via `showNodeIcons`).
   */
  readonly showIcon?: boolean
  readonly label?: GraphTextStyle
  readonly label2?: GraphTextStyle
  readonly tooltip?: GraphTextStyle
  readonly select?: GraphChromeStyle
  readonly hover?: GraphChromeStyle
  readonly shadow?: GraphShadowStyle
}

/** One node in a graph document. */
export interface GraphNode {
  readonly id: string
  readonly type: string
  readonly label: string
  /** Secondary label (Label2Attachment); not derived from `status`. */
  readonly label2?: string
  /** IconRegistry key for IconsAttachment; omitted → default `node`. Unknown keys fall back to `node`. */
  readonly icon?: string
  /** TooltipAttachment text when set. */
  readonly tooltip?: string
  readonly status?: string
  readonly x?: number
  readonly y?: number
  /**
   * Body width in world px. Omitted → engine default `50` (twaver `NODE_WIDTH`).
   * Change at runtime with `updateNode` `{ w }` or resize interactions.
   */
  readonly w?: number
  /**
   * Body height in world px. Omitted → engine default `50` (twaver `NODE_HEIGHT`).
   * Change at runtime with `updateNode` `{ h }` or resize interactions.
   */
  readonly h?: number
  readonly parentId?: string
  readonly groupId?: string
  /** Child SubNetwork id keyed in `document.networks`. */
  readonly networkId?: string
  /** When true, move and membership edits skip this node. */
  readonly locked?: boolean
  readonly alarms?: readonly Alarm[]
  readonly style?: GraphNodeStyle
  readonly data?: Readonly<Record<string, unknown>>
}

/** Directed edge between two node ids. */
export interface GraphEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind?: string
  /**
   * Intermediate bend points between auto endpoint anchors.
   * Absent or empty → orthogonal auto-route from node boxes.
   */
  readonly waypoints?: readonly { readonly x: number; readonly y: number }[]
  readonly alarms?: readonly Alarm[]
  readonly data?: Readonly<Record<string, unknown>>
}

/** Optional paint overrides for a group band outline/fill. */
export interface GraphGroupStyle {
  readonly stroke?: string
  readonly strokeWidth?: number
  /** Canvas setLineDash segments in world px. */
  readonly strokeDash?: readonly number[]
  readonly fill?: string
}

/** Visual grouping band for member nodes. */
export interface GraphGroup {
  readonly id: string
  readonly label: string
  readonly memberIds: readonly string[]
  readonly x?: number
  readonly y?: number
  readonly w?: number
  readonly h?: number
  readonly style?: GraphGroupStyle
}

/**
 * Full graph document (AI / plugin contract).
 * Nested `networks` hold SubNetwork child documents.
 */
export interface GraphDocument {
  readonly version: 1
  readonly meta?: GraphMeta
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly groups?: readonly GraphGroup[]
  readonly networks?: Readonly<Record<string, GraphDocument>>
  readonly viewport?: GraphViewport
}

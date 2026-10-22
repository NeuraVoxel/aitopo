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

/** Fixed attachment anchor relative to the node/group body (free offsets later). */
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
  /** Inside the body, top edge, horizontally centered. */
  | 'insideTop'
  /** Inside the body, upper-left (classic group band title). */
  | 'insideTopLeft'
  /** Inside the body, upper-right. */
  | 'insideTopRight'
  /** Inside the body, bottom edge, horizontally centered (card subtitle). */
  | 'insideBottom'

/** Text paint overrides for label / label2 / tooltip attachments. */
export interface GraphTextStyle {
  readonly color?: string
  readonly fontSize?: number
  /** Canvas font weight. Omitted → `normal`. */
  readonly fontWeight?: 'normal' | 'bold'
  /**
   * Max characters before ellipsis. `0` = never truncate.
   * Omitted → host default (nodes/groups `0`, i.e. unlimited; edges `18`).
   */
  readonly maxChars?: number
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

/**
 * Node/group alarm badge chrome.
 * - `dot` (default): filled circle at `alarmPosition` (demo-stable topRight).
 * - `tag`: outline pill for short codes (skill third-title / eyebrow).
 */
export type AlarmVariant = 'dot' | 'tag'

/** Optional per-node visual overrides (one-level merge on updateNode). */
export interface GraphNodeStyle {
  readonly labelPosition?: AttachmentPosition
  readonly label2Position?: AttachmentPosition
  readonly tooltipPosition?: AttachmentPosition
  /**
   * Alarm badge anchor. Omitted → `topRight` (demo default).
   * Skill third-titles use `insideTopLeft` with `alarmVariant: "tag"`.
   */
  readonly alarmPosition?: AttachmentPosition
  /** Alarm chrome. Omitted → `dot`. */
  readonly alarmVariant?: AlarmVariant
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
  /** Alarm badge text overrides (`color` / `fontSize` / `maxChars`). */
  readonly alarm?: GraphTextStyle
  /** Canvas setLineDash segments in world px for the body outline. */
  readonly strokeDash?: readonly number[]
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
  /** IconRegistry key for IconsAttachment; omitted → default `node`, or `subnetwork` when `networkId` is set. Unknown keys fall back to `node`. */
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

/** Shared arrow head paint for both ends of an edge. */
export interface GraphEdgeArrowStyle {
  readonly size?: number
  readonly fill?: string
  readonly stroke?: string
}

/**
 * Offset side for edge path labels (`label` / `label2`).
 * - `pathLeft` (default): left normal along travel direction (demo-stable).
 * - `pathRight`: right normal along travel.
 * - `aboveOrRight`: screen space — horizontal segment → above; vertical → right.
 */
export type EdgeLabelSide = 'pathLeft' | 'pathRight' | 'aboveOrRight'

/** Optional per-edge visual overrides (one-level merge on updateEdge). */
export interface GraphEdgeStyle {
  readonly stroke?: string
  readonly strokeHover?: string
  readonly lineWidth?: number
  /** Canvas setLineDash segments in world px. */
  readonly strokeDash?: readonly number[]
  /**
   * Whole-edge opacity in `[0, 1]`. Default `1`.
   * Applies to path, arrows, scene attachments, and overlay chrome/tooltip.
   */
  readonly alpha?: number
  /** Arc-length ratio along the polyline for label (0=from, 1=to). Default `0.5`. */
  readonly labelAt?: number
  /** Default `0.15`. */
  readonly label2At?: number
  /** Default `0.85`. */
  readonly alarmAt?: number
  /** Default `0.5`. */
  readonly tooltipAt?: number
  /** Default `hover` — overlay only; `always` joins scene + union bounds. */
  readonly tooltipMode?: 'hover' | 'always'
  /**
   * Label offset relative to the path. Omitted → `pathLeft`.
   * Skill diagrams set `aboveOrRight` (H above / V right).
   */
  readonly labelSide?: EdgeLabelSide
  readonly label?: GraphTextStyle
  readonly label2?: GraphTextStyle
  readonly tooltip?: GraphTextStyle
  readonly select?: GraphChromeStyle
  readonly hover?: GraphChromeStyle
  /** Draw arrow at `from`. Default `false`. */
  readonly arrowFrom?: boolean
  /** Draw arrow at `to`. Default `true`. */
  readonly arrowTo?: boolean
  readonly arrow?: GraphEdgeArrowStyle
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
  /**
   * Pin the source anchor side. Omitted → auto from relative box position.
   */
  readonly fromAnchor?: 'top' | 'bottom' | 'left' | 'right'
  /**
   * Pin the target anchor side. Omitted → auto from relative box position.
   */
  readonly toAnchor?: 'top' | 'bottom' | 'left' | 'right'
  /** Primary label along the path (EdgeLabelAttachment). */
  readonly label?: string
  /** Secondary label along the path (EdgeLabel2Attachment). */
  readonly label2?: string
  /** EdgeTooltipAttachment text when set. */
  readonly tooltip?: string
  readonly alarms?: readonly Alarm[]
  readonly style?: GraphEdgeStyle
  /** Business bag only — renderer does not read visual keys from `data`. */
  readonly data?: Readonly<Record<string, unknown>>
}

/** Optional paint overrides for a group band outline/fill. */
export interface GraphGroupStyle {
  readonly stroke?: string
  readonly strokeWidth?: number
  /** Canvas setLineDash segments in world px. */
  readonly strokeDash?: readonly number[]
  readonly fill?: string
  /**
   * Whole-group opacity in `[0, 1]`. Default `1`.
   * Applies to band body, scene attachments, and overlay chrome/tooltip.
   */
  readonly alpha?: number
  /** Uniform padding around member union when auto-fitting (world px). */
  readonly padding?: number
  /**
   * Top padding when auto-fitting (world px). Omitted → same as `padding`.
   * Set explicitly (e.g. skill insideTop titles) so labels clear members.
   */
  readonly paddingTop?: number
  /**
   * When expanded, grow the band from member body bounds + padding.
   * Default `true` when omitted.
   */
  readonly autoFit?: boolean
  /** Band outline shape. Only `rectangle` this release. */
  readonly shape?: 'rectangle'
  readonly labelPosition?: AttachmentPosition
  readonly label2Position?: AttachmentPosition
  readonly tooltipPosition?: AttachmentPosition
  /** Alarm badge anchor. Omitted → `topRight`. */
  readonly alarmPosition?: AttachmentPosition
  /** Alarm chrome. Omitted → `dot`. */
  readonly alarmVariant?: AlarmVariant
  /** Default `hover` — overlay only; `always` joins scene + union bounds. */
  readonly tooltipMode?: 'hover' | 'always'
  readonly label?: GraphTextStyle
  readonly label2?: GraphTextStyle
  readonly tooltip?: GraphTextStyle
  /** Alarm badge text overrides (`color` / `fontSize` / `maxChars`). */
  readonly alarm?: GraphTextStyle
  readonly select?: GraphChromeStyle
  readonly hover?: GraphChromeStyle
  readonly shadow?: GraphShadowStyle
}

/** Visual grouping band for member nodes. */
export interface GraphGroup {
  readonly id: string
  readonly label: string
  /** Secondary label (Label2Attachment). */
  readonly label2?: string
  /** TooltipAttachment text when set. */
  readonly tooltip?: string
  readonly memberIds: readonly string[]
  /**
   * Whether the band is expanded. Omitted → `false` (collapsed).
   * Open with `updateGroup` `{ expanded: true }` or host gesture.
   */
  readonly expanded?: boolean
  readonly x?: number
  readonly y?: number
  /**
   * Body width in world px when collapsed (or expanded with `autoFit: false`).
   * Omitted → engine default `50` (twaver `NODE_WIDTH`; Group paints as a Node when collapsed).
   * Change at runtime with `updateGroup` `{ w }`.
   */
  readonly w?: number
  /**
   * Body height in world px when collapsed (or expanded with `autoFit: false`).
   * Omitted → engine default `50` (twaver `NODE_HEIGHT`).
   * Change at runtime with `updateGroup` `{ h }`.
   */
  readonly h?: number
  /** When true, move and expand-toggle edits skip this group. */
  readonly locked?: boolean
  /**
   * IconRegistry key for collapsed IconsAttachment; omitted → `group`.
   * Unknown keys fall back to `group`.
   */
  readonly icon?: string
  readonly alarms?: readonly Alarm[]
  readonly style?: GraphGroupStyle
  /** Business bag only — renderer does not read visual keys from `data`. */
  readonly data?: Readonly<Record<string, unknown>>
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

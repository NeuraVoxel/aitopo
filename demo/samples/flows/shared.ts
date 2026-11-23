import type { GraphEdge, GraphNode } from '../../../src/protocol/types.ts'

/** Layout-recipe chrome shared by flowchart demos (skill style, not engine defaults). */
export const FLOW_CHROME = {
  w: 120,
  h: 56,
  data: { fill: '#ffffff', stroke: '#2d3142' },
  style: {
    labelPosition: 'center' as const,
    label: { fontSize: 13, fontWeight: 'bold' as const, color: '#000000' },
    showIcon: false,
  },
}

export const FLOW_CHROME_FOCAL = {
  ...FLOW_CHROME,
  data: { fill: '#ffffff', stroke: '#bf4520' },
}

export const FLOW_CHROME_MUTED = {
  ...FLOW_CHROME,
  data: { fill: '#eef0f3', stroke: '#6b7280' },
}

export const FLOW_EDGE = {
  stroke: '#2d3142',
  labelSide: 'aboveOrRight' as const,
}

export const FLOW_EDGE_FOCAL = {
  stroke: '#bf4520',
  labelSide: 'aboveOrRight' as const,
}

export const FLOW_EDGE_MUTED = {
  stroke: '#6b7280',
  labelSide: 'aboveOrRight' as const,
}

export const FLOW_EDGE_DASH = {
  stroke: '#6b7280',
  strokeDash: [5, 4] as const,
  labelSide: 'aboveOrRight' as const,
}

const LANE_STYLE = {
  fill: '#eef0f3',
  stroke: '#2d3142',
  labelPosition: 'insideTop' as const,
  label: { fontSize: 13, fontWeight: 'bold' as const, color: '#000000' },
  paddingTop: 44,
  padding: 28,
  showIcon: false,
}

/** Expanded Group band used as a swimlane / process lane. */
export function laneGroup(
  id: string,
  label: string,
  memberIds: readonly string[],
  x: number,
  y: number,
) {
  return {
    id,
    label,
    memberIds: [...memberIds],
    expanded: true as const,
    x,
    y,
    style: LANE_STYLE,
  }
}

type Chrome = {
  readonly w: number
  readonly h: number
  readonly data: { readonly fill: string; readonly stroke: string }
  readonly style: typeof FLOW_CHROME.style
}

/** Build a flowchart node with shared chrome. */
export function flowNode(
  partial: Omit<GraphNode, 'w' | 'h' | 'data' | 'style'> & {
    readonly chrome?: Chrome
    readonly label2?: string
  },
): GraphNode {
  const chrome = partial.chrome ?? FLOW_CHROME
  const { chrome: _c, label2, ...rest } = partial
  if (label2 !== undefined) {
    return {
      ...rest,
      label2,
      w: chrome.w,
      h: 64,
      data: { ...chrome.data },
      style: {
        ...chrome.style,
        label2Position: 'insideBottom',
        label2: { fontSize: 9, color: '#6b7280' },
      },
    }
  }
  return {
    ...rest,
    w: chrome.w,
    h: chrome.h,
    data: { ...chrome.data },
    style: { ...chrome.style },
  }
}

/** Orthogonal flow edge with recipe label side. */
export function flowEdge(
  partial: Omit<GraphEdge, 'kind' | 'style'> & {
    readonly kind?: GraphEdge['kind']
    readonly style?: GraphEdge['style']
  },
): GraphEdge {
  const { style: styleOverride, kind: kindOverride, ...rest } = partial
  return {
    ...rest,
    kind: kindOverride ?? 'flow',
    style: { ...FLOW_EDGE, ...styleOverride },
  }
}

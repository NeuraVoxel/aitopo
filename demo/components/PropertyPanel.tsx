import { useRef, useState, type ReactNode } from 'react'
import type { GraphPatch, Network } from '../../src/index.ts'
import {
  buildPropertyPatch,
  LABEL_POSITIONS,
  NODE_DEFAULT_SHADOW,
  type PropertyFields,
  type PropTarget,
} from '../lib/property-patch.ts'

export interface PropertyPanelProps {
  readonly selectedIds: readonly string[]
  readonly applyPatch: (patch: GraphPatch) => void
  readonly getNetwork: () => Network | null
  /** Network neighbor-flood for partial dirty (default off). */
  readonly expandPartialDirty: boolean
  readonly setExpandPartialDirty: (value: boolean) => void
}

interface FormDraft {
  label: string
  x: string
  y: string
  w: string
  h: string
  angle: string
  angleAnchorU: string
  angleAnchorV: string
  type: string
  kind: string
  expanded: boolean
  labelPosition: string
  fill: string
  stroke: string
  strokeWidth: string
  labelColor: string
  labelFontSize: string
  selectColor: string
  selectWidth: string
  selectPadding: string
  selectGlow: boolean
  selectGlowBlur: string
  shadowEnabled: boolean
  shadowBlur: string
  shadowOffsetX: string
  shadowOffsetY: string
  shadowColor: string
  dataJson: string
}

const LABEL_POSITION_OPTIONS = ['', ...LABEL_POSITIONS] as const

/** Engine defaults when `style.select.*` is omitted (matches canvas2d selection chrome). */
const SELECT_DEFAULTS = {
  color: '#3b82f6',
  width: 2,
  padding: 2,
  glow: true,
  glowBlur: 16,
} as const

const EMPTY_DRAFT: FormDraft = {
  label: '',
  x: '',
  y: '',
  w: '',
  h: '',
  angle: '',
  angleAnchorU: '',
  angleAnchorV: '',
  type: '',
  kind: '',
  expanded: false,
  labelPosition: '',
  fill: '',
  stroke: '',
  strokeWidth: '',
  labelColor: '',
  labelFontSize: '',
  selectColor: SELECT_DEFAULTS.color,
  selectWidth: String(SELECT_DEFAULTS.width),
  selectPadding: String(SELECT_DEFAULTS.padding),
  selectGlow: SELECT_DEFAULTS.glow,
  selectGlowBlur: String(SELECT_DEFAULTS.glowBlur),
  shadowEnabled: true,
  shadowBlur: String(NODE_DEFAULT_SHADOW.blur),
  shadowOffsetX: String(NODE_DEFAULT_SHADOW.offsetX),
  shadowOffsetY: String(NODE_DEFAULT_SHADOW.offsetY),
  shadowColor: NODE_DEFAULT_SHADOW.color ?? '',
  dataJson: '{}',
}

/** Right-column inspector: global Network flags + single-select write-back. */
export function PropertyPanel({
  selectedIds,
  applyPatch,
  getNetwork,
  expandPartialDirty,
  setExpandPartialDirty,
}: PropertyPanelProps) {
  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | undefined>(undefined)
  const [seenSnapshot, setSeenSnapshot] = useState('')
  const target = resolveTarget(getNetwork(), selectedIds)
  const networkDraft = target === null ? EMPTY_DRAFT : draftFrom(target)
  const snapshot = target === null ? '' : `${target.kind}:${target.element.id}:${JSON.stringify(networkDraft)}`
  if (snapshot !== seenSnapshot) {
    setSeenSnapshot(snapshot)
    setDraft(networkDraft)
    setError(undefined)
  }
  const formDraft = snapshot !== seenSnapshot ? networkDraft : draft
  const draftRef = useRef(formDraft)
  draftRef.current = formDraft

  const commit = (nextDraft: FormDraft = draftRef.current): void => {
    const current = resolveTarget(getNetwork(), selectedIds)
    if (current === null) return
    try {
      const fields = fieldsFromDraft(current, nextDraft)
      if (Object.keys(fields).length === 0) return
      applyPatch(buildPropertyPatch(current, fields))
      setError(undefined)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const setField = <K extends keyof FormDraft>(key: K, value: FormDraft[K]): void => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const globalSection = (
    <section className="property-section" aria-label="Global">
      <h2 className="property-panel-title">Global</h2>
      <Row label="expand dirty">
        <input
          type="checkbox"
          checked={expandPartialDirty}
          title="Flood-absorb intersecting neighbors into partial dirty (O(n); default on)"
          onChange={event => setExpandPartialDirty(event.target.checked)}
        />
      </Row>
      <p className="property-hint">
        Neighbor flood for partial paints (default on). Off = AA grow only — use for dense stress samples.
      </p>
    </section>
  )

  if (selectedIds.length !== 1) {
    return (
      <aside className="property-panel" aria-label="Properties">
        {globalSection}
        <section className="property-section" aria-label="Element">
          <h2 className="property-panel-title">Element</h2>
          <p className="property-empty">Select one element</p>
        </section>
      </aside>
    )
  }

  if (target === null) {
    return (
      <aside className="property-panel" aria-label="Properties">
        {globalSection}
        <section className="property-section" aria-label="Element">
          <h2 className="property-panel-title">Element</h2>
          <p className="property-empty">Element not in the active network</p>
        </section>
      </aside>
    )
  }

  const kindLabel = kindTitle(target.kind)
  const id = target.element.id
  const alarms = formatAlarms(target)
  const showsAngle = target.kind !== 'edge'
  const showsBox = target.kind === 'node' || target.kind === 'group'
  const showsFill = target.kind === 'group' || target.kind === 'path' || target.kind === 'shapeNode'
  const showsStroke =
    target.kind === 'edge'
    || target.kind === 'group'
    || target.kind === 'path'
    || target.kind === 'shapeNode'
  const showsShadow = target.kind === 'node' || target.kind === 'group'

  return (
    <aside className="property-panel" aria-label="Properties">
      {globalSection}
      <section className="property-section" aria-label={`Element ${kindLabel}`}>
      <h2 className="property-panel-title">Element · {kindLabel}</h2>
      <Row label="id">
        <span className="property-readonly">{id}</span>
      </Row>
      <TextRow
        label="label"
        value={formDraft.label}
        onChange={value => setField('label', value)}
        onCommit={() => commit()}
      />
      {target.kind === 'node' && (
        <TextRow
          label="type"
          value={formDraft.type}
          onChange={value => setField('type', value)}
          onCommit={() => commit()}
        />
      )}
      {target.kind === 'edge' && (
        <>
          <TextRow
            label="kind"
            value={formDraft.kind}
            onChange={value => setField('kind', value)}
            onCommit={() => commit()}
          />
          <Row label="from">
            <span className="property-readonly">{target.element.from}</span>
          </Row>
          <Row label="to">
            <span className="property-readonly">{target.element.to}</span>
          </Row>
        </>
      )}
      {target.kind === 'group' && (
        <>
          <Row label="expanded">
            <input
              type="checkbox"
              checked={formDraft.expanded}
              onChange={event => {
                const next = { ...draftRef.current, expanded: event.target.checked }
                setDraft(next)
                commit(next)
              }}
            />
          </Row>
          <Row label="members">
            <span className="property-readonly">{target.element.memberIds.join(', ') || '—'}</span>
          </Row>
        </>
      )}
      {showsBox && (
        <>
          <TextRow label="x" value={formDraft.x} onChange={value => setField('x', value)} onCommit={() => commit()} />
          <TextRow label="y" value={formDraft.y} onChange={value => setField('y', value)} onCommit={() => commit()} />
          <TextRow label="w" value={formDraft.w} onChange={value => setField('w', value)} onCommit={() => commit()} />
          <TextRow label="h" value={formDraft.h} onChange={value => setField('h', value)} onCommit={() => commit()} />
          <Row label="label pos">
            <select
              value={formDraft.labelPosition}
              onChange={event => {
                const next = { ...draftRef.current, labelPosition: event.target.value }
                setDraft(next)
                commit(next)
              }}
            >
              {LABEL_POSITION_OPTIONS.map(option => (
                <option key={option || 'unset'} value={option}>
                  {option || '(default)'}
                </option>
              ))}
            </select>
          </Row>
        </>
      )}
      {showsAngle && (
        <>
          <TextRow
            label="angle"
            value={formDraft.angle}
            onChange={value => setField('angle', value)}
            onCommit={() => commit()}
          />
          <TextRow
            label="anchor u"
            value={formDraft.angleAnchorU}
            onChange={value => setField('angleAnchorU', value)}
            onCommit={() => commit()}
          />
          <TextRow
            label="anchor v"
            value={formDraft.angleAnchorV}
            onChange={value => setField('angleAnchorV', value)}
            onCommit={() => commit()}
          />
        </>
      )}
      {showsFill && (
        <TextRow
          label="fill"
          value={formDraft.fill}
          onChange={value => setField('fill', value)}
          onCommit={() => commit()}
        />
      )}
      {showsStroke && (
        <>
          <TextRow
            label="stroke"
            value={formDraft.stroke}
            onChange={value => setField('stroke', value)}
            onCommit={() => commit()}
          />
          <TextRow
            label="stroke w"
            value={formDraft.strokeWidth}
            onChange={value => setField('strokeWidth', value)}
            onCommit={() => commit()}
          />
        </>
      )}
      <TextRow
        label="label color"
        value={formDraft.labelColor}
        onChange={value => setField('labelColor', value)}
        onCommit={() => commit()}
      />
      <TextRow
        label="label size"
        value={formDraft.labelFontSize}
        onChange={value => setField('labelFontSize', value)}
        onCommit={() => commit()}
      />
      <TextRow
        label="select color"
        value={formDraft.selectColor}
        onChange={value => setField('selectColor', value)}
        onCommit={() => commit()}
      />
      <TextRow
        label="select w"
        value={formDraft.selectWidth}
        onChange={value => setField('selectWidth', value)}
        onCommit={() => commit()}
      />
      <TextRow
        label="select pad"
        value={formDraft.selectPadding}
        onChange={value => setField('selectPadding', value)}
        onCommit={() => commit()}
      />
      <Row label="select glow">
        <input
          type="checkbox"
          checked={formDraft.selectGlow}
          onChange={event => {
            const next = { ...draftRef.current, selectGlow: event.target.checked }
            setDraft(next)
            commit(next)
          }}
        />
      </Row>
      <TextRow
        label="glow blur"
        value={formDraft.selectGlowBlur}
        onChange={value => setField('selectGlowBlur', value)}
        onCommit={() => commit()}
      />
      {showsShadow && (
        <>
          <Row label="shadow">
            <input
              type="checkbox"
              checked={formDraft.shadowEnabled}
              onChange={event => {
                const next = { ...draftRef.current, shadowEnabled: event.target.checked }
                setDraft(next)
                commit(next)
              }}
            />
          </Row>
          <TextRow
            label="shadow blur"
            value={formDraft.shadowBlur}
            onChange={value => setField('shadowBlur', value)}
            onCommit={() => commit()}
          />
          <TextRow
            label="shadow ox"
            value={formDraft.shadowOffsetX}
            onChange={value => setField('shadowOffsetX', value)}
            onCommit={() => commit()}
          />
          <TextRow
            label="shadow oy"
            value={formDraft.shadowOffsetY}
            onChange={value => setField('shadowOffsetY', value)}
            onCommit={() => commit()}
          />
          <TextRow
            label="shadow color"
            value={formDraft.shadowColor}
            onChange={value => setField('shadowColor', value)}
            onCommit={() => commit()}
          />
        </>
      )}
      <Row label="alarms">
        <span className="property-readonly">{alarms}</span>
      </Row>
      <Row label="data">
        <textarea
          rows={4}
          value={formDraft.dataJson}
          spellCheck={false}
          onChange={event => setField('dataJson', event.target.value)}
          onBlur={() => commit()}
        />
      </Row>
      {error !== undefined && <p className="property-error" role="alert">{error}</p>}
      </section>
    </aside>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="property-row">
      <label>{label}</label>
      {children}
    </div>
  )
}

function TextRow(props: {
  label: string
  value: string
  onChange: (value: string) => void
  onCommit: () => void
}) {
  return (
    <Row label={props.label}>
      <input
        type="text"
        value={props.value}
        onChange={event => props.onChange(event.target.value)}
        onBlur={props.onCommit}
        onKeyDown={event => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          event.currentTarget.blur()
        }}
      />
    </Row>
  )
}

function kindTitle(kind: PropTarget['kind']): string {
  switch (kind) {
    case 'node':
      return 'Node'
    case 'edge':
      return 'Edge'
    case 'group':
      return 'Group'
    case 'path':
      return 'Path'
    case 'shapeNode':
      return 'ShapeNode'
    default: {
      const _e: never = kind
      return _e
    }
  }
}

function resolveTarget(network: Network | null, selectedIds: readonly string[]): PropTarget | null {
  if (network === null || selectedIds.length !== 1) return null
  const id = selectedIds[0]!
  const node = network.getNodes().find(element => element.id === id)
  if (node !== undefined) return { kind: 'node', element: node }
  const edge = network.getEdges().find(element => element.id === id)
  if (edge !== undefined) return { kind: 'edge', element: edge }
  const group = network.getGroups().find(element => element.id === id)
  if (group !== undefined) return { kind: 'group', element: group }
  const path = network.getPaths().find(element => element.id === id)
  if (path !== undefined) return { kind: 'path', element: path }
  const shapeNode = network.getShapeNodes().find(element => element.id === id)
  if (shapeNode !== undefined) return { kind: 'shapeNode', element: shapeNode }
  return null
}

function selectDraftFields(
  select: { readonly color?: string; readonly width?: number; readonly padding?: number; readonly glow?: boolean; readonly glowBlur?: number } | undefined,
): Pick<FormDraft, 'selectColor' | 'selectWidth' | 'selectPadding' | 'selectGlow' | 'selectGlowBlur'> {
  return {
    selectColor: select?.color ?? SELECT_DEFAULTS.color,
    selectWidth: numStr(select?.width ?? SELECT_DEFAULTS.width),
    selectPadding: numStr(select?.padding ?? SELECT_DEFAULTS.padding),
    selectGlow: select?.glow !== false,
    selectGlowBlur: numStr(select?.glowBlur ?? SELECT_DEFAULTS.glowBlur),
  }
}

function shadowDraftFields(
  shadow: { readonly color?: string; readonly blur?: number; readonly offsetX?: number; readonly offsetY?: number } | null | undefined,
  host: 'node' | 'group',
): Pick<FormDraft, 'shadowEnabled' | 'shadowBlur' | 'shadowOffsetX' | 'shadowOffsetY' | 'shadowColor'> {
  if (shadow === null) {
    const fallback = host === 'node' ? NODE_DEFAULT_SHADOW : { blur: 0, offsetX: 0, offsetY: 0, color: '' }
    return {
      shadowEnabled: false,
      shadowBlur: numStr(fallback.blur ?? 0),
      shadowOffsetX: numStr(fallback.offsetX ?? 0),
      shadowOffsetY: numStr(fallback.offsetY ?? 0),
      shadowColor: fallback.color ?? '',
    }
  }
  const resolved =
    shadow !== undefined
      ? shadow
      : (host === 'node' ? NODE_DEFAULT_SHADOW : undefined)
  return {
    shadowEnabled: host === 'node' ? true : resolved !== undefined,
    shadowBlur: numStr(resolved?.blur ?? (host === 'node' ? NODE_DEFAULT_SHADOW.blur : 0)),
    shadowOffsetX: numStr(resolved?.offsetX ?? (host === 'node' ? NODE_DEFAULT_SHADOW.offsetX : 0)),
    shadowOffsetY: numStr(resolved?.offsetY ?? (host === 'node' ? NODE_DEFAULT_SHADOW.offsetY : 0)),
    shadowColor: resolved?.color ?? (host === 'node' ? (NODE_DEFAULT_SHADOW.color ?? '') : ''),
  }
}

function draftFrom(target: PropTarget): FormDraft {
  const data = stringData(target.element.data)
  const labelStyle = target.element.style?.label
  const select = selectDraftFields(target.element.style?.select)
  const base: FormDraft = {
    ...EMPTY_DRAFT,
    ...select,
    label: target.element.label ?? '',
    labelColor: labelStyle?.color ?? '',
    labelFontSize: numStr(labelStyle?.fontSize),
    dataJson: JSON.stringify(data, null, 2),
  }
  switch (target.kind) {
    case 'node':
      return {
        ...base,
        ...shadowDraftFields(target.element.style?.shadow, 'node'),
        type: target.element.type,
        x: numStr(target.element.x),
        y: numStr(target.element.y),
        w: numStr(target.element.w),
        h: numStr(target.element.h),
        angle: angleStr(target.element.angle ?? 0),
        angleAnchorU: numStr(target.element.angleAnchor?.u ?? 0.5),
        angleAnchorV: numStr(target.element.angleAnchor?.v ?? 0.5),
        labelPosition: target.element.style?.labelPosition ?? '',
      }
    case 'edge':
      return {
        ...base,
        kind: target.element.kind ?? '',
        stroke: target.element.style?.stroke ?? '',
        strokeWidth: numStr(target.element.style?.lineWidth),
      }
    case 'group':
      return {
        ...base,
        ...shadowDraftFields(target.element.style?.shadow, 'group'),
        expanded: target.element.expanded === true,
        x: numStr(target.element.x),
        y: numStr(target.element.y),
        w: numStr(target.element.w),
        h: numStr(target.element.h),
        angle: angleStr(target.element.angle ?? 0),
        angleAnchorU: numStr(target.element.angleAnchor?.u ?? 0.5),
        angleAnchorV: numStr(target.element.angleAnchor?.v ?? 0.5),
        labelPosition: target.element.style?.labelPosition ?? '',
        fill: target.element.style?.fill ?? '',
        stroke: target.element.style?.stroke ?? '',
        strokeWidth: numStr(target.element.style?.strokeWidth),
      }
    case 'path':
      return {
        ...base,
        angle: angleStr(target.element.angle ?? 0),
        angleAnchorU: numStr(target.element.angleAnchor?.u ?? 0.5),
        angleAnchorV: numStr(target.element.angleAnchor?.v ?? 0.5),
        fill: target.element.style?.fill ?? '',
        stroke: target.element.style?.stroke ?? '',
        strokeWidth: numStr(target.element.style?.lineWidth),
      }
    case 'shapeNode':
      return {
        ...base,
        angle: angleStr(target.element.angle ?? 0),
        angleAnchorU: numStr(target.element.angleAnchor?.u ?? 0.5),
        angleAnchorV: numStr(target.element.angleAnchor?.v ?? 0.5),
        fill: target.element.style?.fill ?? '',
        stroke: target.element.style?.stroke ?? '',
        strokeWidth: numStr(target.element.style?.lineWidth),
      }
    default: {
      const _e: never = target
      return _e
    }
  }
}

function fieldsFromDraft(target: PropTarget, draft: FormDraft): PropertyFields {
  const current = draftFrom(target)
  const fields: PropertyFields = {}
  if (draft.label !== current.label) fields.label = draft.label
  assignNumber(fields, 'x', draft.x, current.x)
  assignNumber(fields, 'y', draft.y, current.y)
  assignNumber(fields, 'w', draft.w, current.w)
  assignNumber(fields, 'h', draft.h, current.h)
  assignNumber(fields, 'angle', draft.angle, current.angle)
  assignNumber(fields, 'angleAnchorU', draft.angleAnchorU, current.angleAnchorU)
  assignNumber(fields, 'angleAnchorV', draft.angleAnchorV, current.angleAnchorV)
  if (target.kind === 'node' && draft.type !== current.type) fields.type = draft.type
  if (target.kind === 'edge' && draft.kind !== current.kind) fields.kind = draft.kind
  if (target.kind === 'group' && draft.expanded !== current.expanded) {
    fields.expanded = draft.expanded
  }
  if (draft.labelPosition !== current.labelPosition && draft.labelPosition !== '') {
    fields.labelPosition = draft.labelPosition
  }
  if (draft.fill !== current.fill) fields.fill = draft.fill
  if (draft.stroke !== current.stroke) fields.stroke = draft.stroke
  assignNumber(fields, 'strokeWidth', draft.strokeWidth, current.strokeWidth)
  if (draft.labelColor !== current.labelColor) fields.labelColor = draft.labelColor
  assignNumber(fields, 'labelFontSize', draft.labelFontSize, current.labelFontSize)
  if (draft.selectColor !== current.selectColor) fields.selectColor = draft.selectColor
  assignNumber(fields, 'selectWidth', draft.selectWidth, current.selectWidth)
  assignNumber(fields, 'selectPadding', draft.selectPadding, current.selectPadding)
  if (draft.selectGlow !== current.selectGlow) fields.selectGlow = draft.selectGlow
  assignNumber(fields, 'selectGlowBlur', draft.selectGlowBlur, current.selectGlowBlur)
  if (draft.shadowEnabled !== current.shadowEnabled) fields.shadowEnabled = draft.shadowEnabled
  assignNumber(fields, 'shadowBlur', draft.shadowBlur, current.shadowBlur)
  assignNumber(fields, 'shadowOffsetX', draft.shadowOffsetX, current.shadowOffsetX)
  assignNumber(fields, 'shadowOffsetY', draft.shadowOffsetY, current.shadowOffsetY)
  if (draft.shadowColor !== current.shadowColor) fields.shadowColor = draft.shadowColor
  if (draft.dataJson !== current.dataJson) fields.dataJson = draft.dataJson
  return fields
}

function assignNumber(
  fields: PropertyFields,
  key:
    | 'x'
    | 'y'
    | 'w'
    | 'h'
    | 'angle'
    | 'angleAnchorU'
    | 'angleAnchorV'
    | 'strokeWidth'
    | 'labelFontSize'
    | 'selectWidth'
    | 'selectPadding'
    | 'selectGlowBlur'
    | 'shadowBlur'
    | 'shadowOffsetX'
    | 'shadowOffsetY',
  draft: string,
  current: string,
): void {
  if (draft === current) return
  const trimmed = draft.trim()
  if (trimmed === '') return
  const value = Number(trimmed)
  if (!Number.isFinite(value)) throw new Error(`Invalid ${key}`)
  fields[key] = value
}

function numStr(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

/** Property-panel angle field: fixed 2 decimal places. */
function angleStr(value: number | undefined): string {
  if (value === undefined) return ''
  return (Math.round(value * 100) / 100).toFixed(2)
}

function stringData(data: Readonly<Record<string, unknown>> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (data === undefined) return out
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

function formatAlarms(target: PropTarget): string {
  if (target.kind === 'path') return 'none'
  const alarms = target.element.alarms
  if (alarms === undefined || alarms.length === 0) return 'none'
  return alarms.map(alarm => `${alarm.level}: ${alarm.message}`).join('; ')
}

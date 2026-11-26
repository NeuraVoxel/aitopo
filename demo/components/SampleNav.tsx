import { useState } from 'react'
import type { DemoSample, DemoSampleGroupId } from '../samples/types.ts'

export interface SampleNavProps {
  readonly samples: readonly DemoSample[]
  readonly activeId: string
  readonly onSelect: (id: string) => void
}

const GROUP_ORDER: readonly DemoSampleGroupId[] = [
  'elements',
  'adas',
  'agents',
  'dsh',
  'flows',
  'business',
]

const GROUP_LABEL: Record<DemoSampleGroupId, string> = {
  elements: 'Elements',
  agents: 'Agents',
  dsh: 'DeepSeek Harness',
  flows: 'WorkFlow',
  adas: 'ADAS',
  business: 'Business (soon)',
}

/** Grouped sample catalog with collapsible sections (all expanded by default). */
export function SampleNav({ samples, activeId, onSelect }: SampleNavProps) {
  const [openGroups, setOpenGroups] = useState<ReadonlySet<DemoSampleGroupId>>(
    new Set(GROUP_ORDER),
  )
  const toggle = (groupId: DemoSampleGroupId): void => {
    setOpenGroups(previous => {
      const next = new Set(previous)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }
  return (
    <nav className="sample-nav" aria-label="Samples">
      {GROUP_ORDER.map(groupId => {
        const items = samples.filter(sample => sample.group === groupId)
        if (items.length === 0) return null
        const open = openGroups.has(groupId)
        return (
          <section key={groupId} className="sample-nav-group">
            <button
              type="button"
              className="sample-nav-heading"
              aria-expanded={open}
              onClick={() => toggle(groupId)}
            >
              <span className="sample-nav-caret" aria-hidden="true">▸</span>
              {GROUP_LABEL[groupId]}
            </button>
            {open && (
              <ul className="sample-nav-list">
                {items.map(sample => {
                  const reserved = sample.reserved === true
                  const active = sample.id === activeId
                  return (
                    <li
                      key={sample.id}
                      className="sample-nav-row"
                      onClick={() => onSelect(sample.id)}
                    >
                      <button
                        type="button"
                        className={[
                          'sample-nav-item',
                          active ? 'is-active' : '',
                          reserved ? 'disabled' : '',
                        ].filter(Boolean).join(' ')}
                        disabled={reserved}
                        aria-disabled={reserved}
                        aria-current={active ? 'true' : undefined}
                        title={sample.description}
                      >
                        {sample.title}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </nav>
  )
}

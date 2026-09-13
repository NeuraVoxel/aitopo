import type { DemoSample, DemoSampleGroupId } from '../samples/types.ts'

export interface SampleNavProps {
  readonly samples: readonly DemoSample[]
  readonly activeId: string
  readonly onSelect: (id: string) => void
}

const GROUP_ORDER: readonly DemoSampleGroupId[] = [
  'getting-started',
  'elements',
  'agents',
  'dsh',
  'business',
]

const GROUP_LABEL: Record<DemoSampleGroupId, string> = {
  'getting-started': 'Getting started',
  elements: 'Elements',
  agents: 'Agents',
  dsh: 'DeepSeek Harness',
  business: 'Business (soon)',
}

/** Grouped sample catalog. Reserved rows stay clickable so the hook can set status. */
export function SampleNav({ samples, activeId, onSelect }: SampleNavProps) {
  return (
    <nav className="sample-nav" aria-label="Samples">
      {GROUP_ORDER.map(groupId => {
        const items = samples.filter(sample => sample.group === groupId)
        if (items.length === 0) return null
        return (
          <section key={groupId} className="sample-nav-group">
            <h2 className="sample-nav-heading">{GROUP_LABEL[groupId]}</h2>
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
          </section>
        )
      })}
    </nav>
  )
}

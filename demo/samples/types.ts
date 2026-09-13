import type { GraphDocument } from '../../src/protocol/types.ts'

export type DemoSampleGroupId =
  | 'getting-started'
  | 'elements'
  | 'agents'
  | 'dsh'
  | 'business'

export interface DemoSample {
  readonly id: string
  readonly title: string
  readonly group: DemoSampleGroupId
  readonly description: string
  /** When true, nav shows disabled; load is a no-op with status message. */
  readonly reserved?: boolean
  readonly defaultLayout?: 'grid' | 'flow'
  readonly document: GraphDocument
}

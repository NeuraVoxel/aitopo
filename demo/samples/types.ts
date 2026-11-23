import type { GraphDocument } from '../../src/protocol/types.ts'

export type DemoSampleGroupId =
  | 'started'
  | 'elements'
  | 'agents'
  | 'dsh'
  | 'flows'
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
  /**
   * Live sample kind: the static `document` is a pre-load placeholder and the
   * host renders a data source bar that replaces it with fetched content.
   */
  readonly live?: 'dsh-sessions'
}
